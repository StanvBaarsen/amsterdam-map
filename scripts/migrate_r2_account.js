// One-off: copy the tile data into an `amsterdam-map-tiles` bucket on a second
// Cloudflare account, so the original bucket (on the old account) can be
// retired. Reads R2_NEW_* from .env; uploads from the same local data/ folders
// that upload_to_r2.js syncs.
//
// Safe to re-run: it lists what is already in the destination and skips any
// object whose size already matches, so an interrupted run resumes cheaply.

import { S3Client, PutObjectCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dotenv from 'dotenv';

dotenv.config();

const ACCOUNT_ID = process.env.R2_NEW_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_NEW_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_NEW_SECRET_ACCESS_KEY;
const BUCKET_NAME = 'amsterdam-map-tiles';

// How many uploads to keep in flight. The dataset is ~39k small files, so
// serial uploads would take hours.
const CONCURRENCY = 24;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.error("Error: set R2_NEW_ACCOUNT_ID, R2_NEW_ACCESS_KEY_ID and R2_NEW_SECRET_ACCESS_KEY in .env");
    process.exit(1);
}

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    },
});

const foldersToUpload = [
    'data/amsterdam_3dtiles_lod12',
    'data/amsterdam_3dtiles_lod22',
    'data/basemap'
];

async function ensureBucket() {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`✅ Bucket ${BUCKET_NAME} already exists on the destination account.`);
        return;
    } catch (err) {
        if (err.$metadata?.httpStatusCode !== 404 && err.name !== 'NotFound') throw err;
    }
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ Created bucket ${BUCKET_NAME}.`);
}

async function fetchExistingFiles() {
    const existing = new Map();
    let continuationToken;
    do {
        const response = await s3.send(new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            ContinuationToken: continuationToken,
        }));
        for (const object of response.Contents ?? []) {
            existing.set(object.Key, object.Size);
        }
        continuationToken = response.NextContinuationToken;
        process.stdout.write(`\r🔍 Already in destination: ${existing.size} objects...`);
    } while (continuationToken);
    console.log('');
    return existing;
}

function collectLocalFiles() {
    const files = [];
    const dataRoot = path.join(process.cwd(), 'data');

    const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                // data/basemap/x/y/z.png -> basemap/x/y/z.png
                const key = path.relative(dataRoot, fullPath).split(path.sep).join('/');
                files.push({ fullPath, key, size: fs.statSync(fullPath).size });
            }
        }
    };

    for (const folder of foldersToUpload) {
        const fullFolderPath = path.join(process.cwd(), folder);
        if (!fs.existsSync(fullFolderPath)) {
            console.error(`❌ Folder not found: ${folder}`);
            process.exit(1);
        }
        walk(fullFolderPath);
    }
    return files;
}

async function uploadAll(queue) {
    let done = 0;
    let failed = 0;
    const total = queue.length;

    const worker = async () => {
        while (queue.length > 0) {
            const file = queue.pop();
            try {
                await s3.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.key,
                    Body: fs.readFileSync(file.fullPath),
                    ContentType: mime.lookup(file.fullPath) || 'application/octet-stream',
                }));
            } catch (err) {
                failed++;
                console.error(`\n❌ Failed: ${file.key}: ${err.name} ${err.message}`);
            }
            done++;
            if (done % 100 === 0 || done === total) {
                process.stdout.write(`\r⬆️  Uploaded ${done}/${total} (${failed} failed)`);
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log('');
    return failed;
}

async function main() {
    console.log(`🚀 Migrating tiles to ${BUCKET_NAME} on account ${ACCOUNT_ID}`);

    await ensureBucket();
    const existing = await fetchExistingFiles();

    const local = collectLocalFiles();
    const queue = local.filter((file) => existing.get(file.key) !== file.size);
    console.log(`📦 ${local.length} local objects, ${local.length - queue.length} already match, ${queue.length} to upload.`);

    if (queue.length === 0) {
        console.log("✨ Destination already complete.");
        return;
    }

    const failed = await uploadAll(queue);
    if (failed > 0) {
        console.error(`\n⚠️  ${failed} uploads failed. Re-run to retry just those.`);
        process.exit(1);
    }
    console.log("✨ Migration upload complete.");
}

main();

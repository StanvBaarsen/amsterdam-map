import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration.
//
// The tiles moved to the mail@ Cloudflare account in August 2026 (see
// migrate_r2_account.js), so this reads R2_NEW_* rather than the old R2_*
// credentials, which addressed a bucket that no longer exists.
const ACCOUNT_ID = process.env.R2_NEW_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_NEW_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_NEW_SECRET_ACCESS_KEY;
const BUCKET_NAME = 'amsterdam-map-tiles'; // Update if different

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.error("Error: Please set R2_NEW_ACCOUNT_ID, R2_NEW_ACCESS_KEY_ID, and R2_NEW_SECRET_ACCESS_KEY environment variables.");
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

// Set to store existing keys mapped to their size
const existingKeys = new Map();
// Set to store local keys (files that should exist)
const localKeys = new Set();

async function fetchExistingFiles() {
    console.log("🔍 Checking for existing files in bucket...");
    let continuationToken = undefined;
    let count = 0;

    do {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            ContinuationToken: continuationToken,
        });

        try {
            const response = await s3.send(command);
            if (response.Contents) {
                for (const object of response.Contents) {
                    existingKeys.set(object.Key, object.Size);
                    count++;
                }
            }
            continuationToken = response.NextContinuationToken;
            process.stdout.write(`\rFound ${count} existing files...`);
        } catch (err) {
            console.error("\n❌ Error listing objects:", err);
            break;
        }
    } while (continuationToken);
    console.log(`\n✅ Found ${existingKeys.size} files already uploaded.`);
}

async function uploadFile(filePath, key) {
    const stat = fs.statSync(filePath);
    const localSize = stat.size;

    if (existingKeys.has(key)) {
        const remoteSize = existingKeys.get(key);
        if (remoteSize === localSize) {
             // console.log(`⏭️  Skipping (already exists & same size): ${key}`);
             return;
        }
        console.log(`🔄 Updating (size changed): ${key} (R2: ${remoteSize} -> Local: ${localSize})`);
    }

    const fileContent = fs.readFileSync(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    try {
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: contentType,
        }));
        console.log(`✅ Uploaded: ${key}`);
    } catch (err) {
        console.error(`❌ Failed to upload ${key}:`, err);
    }
}

async function processDirectory(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            await processDirectory(fullPath);
        } else {
            // Calculate key relative to data/
            // e.g. data/basemap/tiles/x/y/z.png -> basemap/tiles/x/y/z.png
            const relativePath = path.relative(path.join(process.cwd(), 'data'), fullPath);
            // Ensure forward slashes for S3 keys
            const key = relativePath.split(path.sep).join('/');
            localKeys.add(key);
            await uploadFile(fullPath, key);
        }
    }
}

async function deleteExtraneousFiles() {
    const keysToDelete = [];
    for (const key of existingKeys.keys()) {
        if (!localKeys.has(key)) {
            keysToDelete.push({ Key: key });
        }
    }

    if (keysToDelete.length === 0) {
        console.log("✨ No extraneous files to delete.");
        return;
    }

    console.log(`🗑️  Found ${keysToDelete.length} files to delete from R2...`);

    // Batch delete in chunks of 1000
    const chunkSize = 1000;
    for (let i = 0; i < keysToDelete.length; i += chunkSize) {
        const chunk = keysToDelete.slice(i, i + chunkSize);
        try {
            const command = new DeleteObjectsCommand({
                Bucket: BUCKET_NAME,
                Delete: {
                    Objects: chunk,
                },
            });
            await s3.send(command);
            console.log(`🗑️  Deleted batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(keysToDelete.length / chunkSize)} (${chunk.length} files)`);
        } catch (err) {
            console.error("❌ Error deleting files:", err);
        }
    }
}

async function main() {
    console.log("🚀 Starting upload to Cloudflare R2...");
    
    await fetchExistingFiles();

    for (const folder of foldersToUpload) {
        const fullFolderPath = path.join(process.cwd(), folder);
        if (fs.existsSync(fullFolderPath)) {
            console.log(`📂 Processing folder: ${folder}`);
            await processDirectory(fullFolderPath);
        } else {
            console.warn(`⚠️ Folder not found: ${folder}`);
        }
    }
    
    await deleteExtraneousFiles();

    console.log("✨ Upload complete!");
}

main();

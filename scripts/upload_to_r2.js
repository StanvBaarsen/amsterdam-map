import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = 'amsterdam-map-tiles'; // Update if different

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.error("Error: Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.");
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
    'public/amsterdam_3dtiles_lod12',
    'public/amsterdam_3dtiles_lod13',
    'public/amsterdam_3dtiles_lod22',
    'public/basemap'
];

// Set to store existing keys
const existingKeys = new Set();

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
                    existingKeys.add(object.Key);
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
    if (existingKeys.has(key)) {
        // console.log(`⏭️  Skipping (already exists): ${key}`);
        return;
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
            // Calculate key relative to public/
            // e.g. public/basemap/tiles/x/y/z.png -> basemap/tiles/x/y/z.png
            const relativePath = path.relative(path.join(process.cwd(), 'public'), fullPath);
            // Ensure forward slashes for S3 keys
            const key = relativePath.split(path.sep).join('/');
            await uploadFile(fullPath, key);
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

    console.log("✨ Upload complete!");
}

main();

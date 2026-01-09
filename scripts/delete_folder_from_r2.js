import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuration
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = 'amsterdam-map-tiles'; 

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.error("Error: Please set R2 env vars.");
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

async function deletePrefix(prefix) {
    console.log(`🗑️  Deleting all objects with prefix: ${prefix}`);
    
    let continuationToken = undefined;
    let totalDeleted = 0;

    do {
        // List objects
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });

        const response = await s3.send(listCommand);
        
        if (!response.Contents || response.Contents.length === 0) {
            break;
        }

        const objectsToDelete = response.Contents.map(obj => ({ Key: obj.Key }));
        
        // Delete objects
        const deleteCommand = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: {
                Objects: objectsToDelete,
            },
        });

        await s3.send(deleteCommand);
        totalDeleted += objectsToDelete.length;
        console.log(`Deleted ${objectsToDelete.length} files... (Total: ${totalDeleted})`);

        continuationToken = response.NextContinuationToken;

    } while (continuationToken);

    console.log(`✅ Finished deleting ${totalDeleted} files from ${prefix}`);
}

async function main() {
    const prefixes = process.argv.slice(2);
    if (prefixes.length === 0) {
        console.log("Usage: node scripts/delete_folder_from_r2.js <folder_prefix1> [folder_prefix2] ...");
        return;
    }

    for (const prefix of prefixes) {
        await deletePrefix(prefix);
    }
}

main();

/**
 * Count files in Firebase Storage bucket
 *
 * Uses Firebase Admin SDK. Requires a service account key.
 *
 * Setup:
 * 1. Firebase Console → Project Settings → Service accounts → Generate new private key
 * 2. Save the JSON somewhere (e.g. project root as serviceAccountKey.json) and add to .gitignore
 * 3. Set: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *
 * Run:
 *   node scripts/count-storage-files.js
 *   node scripts/count-storage-files.js --prefix ""
 *     (empty prefix = count entire bucket; default prefix is "places/" to match your app)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const prefixArg = args.find((a) => a.startsWith('--prefix='));
const prefix = prefixArg ? prefixArg.split('=')[1] : 'places/';

function getStorageBucket() {
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    return process.env.FIREBASE_STORAGE_BUCKET;
  }
  try {
    const envPath = path.join(__dirname, '../src/config/environment.ts');
    const envFile = fs.readFileSync(envPath, 'utf-8');
    const m = envFile.match(/storageBucket:\s*process\.env\.FIREBASE_STORAGE_BUCKET\s*\|\|\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  } catch (e) {
    // ignore
  }
  return null;
}

async function main() {
  const bucketName = getStorageBucket();
  if (!bucketName) {
    console.error('Could not determine storage bucket. Set FIREBASE_STORAGE_BUCKET or use environment.ts.');
    process.exit(1);
  }

  let credential;
  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, '../serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    credential = require('firebase-admin').credential.cert(key);
  } else {
    console.error(
      'No service account key found. Set GOOGLE_APPLICATION_CREDENTIALS or add serviceAccountKey.json to project root.'
    );
    console.error('Get the key from: Firebase Console → Project Settings → Service accounts → Generate new private key');
    process.exit(1);
  }

  const { initializeApp } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');

  initializeApp({
    credential,
    storageBucket: bucketName,
  });

  const bucket = getStorage().bucket();
  const options = prefix ? { prefix } : {};
  const [files] = await bucket.getFiles(options);

  const label = prefix ? `under prefix "${prefix}"` : 'in bucket';
  console.log(`Storage bucket: ${bucketName}`);
  console.log(`Files ${label}: ${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

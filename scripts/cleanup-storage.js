#!/usr/bin/env node

/**
 * Firebase Storage Cleanup Script
 * 
 * Scans Firebase Storage for all files and cross-references with Firestore
 * to find and delete orphaned files that are no longer referenced.
 * 
 * Usage:
 *   node scripts/cleanup-storage.js [--dry-run]
 * 
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
 *   - Or place service-account.json in project root
 *   - firebase-admin must be installed in functions/ directory
 * 
 * Setup:
 *   1. Go to Firebase Console > Project Settings > Service Accounts
 *   2. Click "Generate new private key"
 *   3. Save as service-account.json in project root
 *   4. Run: node scripts/cleanup-storage.js --dry-run
 */

const fs = require("fs");
const path = require("path");

// Load firebase-admin from functions directory
const admin = require(path.join(__dirname, "..", "functions", "node_modules", "firebase-admin"));

// Initialize Firebase Admin with service account
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, "..", "service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Service account not found!");
  console.error("");
  console.error("To use this script, you need a Firebase service account:");
  console.error("1. Go to Firebase Console > Project Settings > Service Accounts");
  console.error("2. Click 'Generate new private key'");
  console.error(`3. Save as: ${path.join(__dirname, "..", "service-account.json")}`);
  console.error("4. Or set GOOGLE_APPLICATION_CREDENTIALS env var");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(serviceAccountPath))),
  storageBucket: "dalseshop.firebasestorage.app",
});

const db = admin.firestore();
const bucket = admin.storage().bucket("dalseshop.firebasestorage.app");

const DRY_RUN = process.argv.includes("--dry-run");

// Collections to scan for image references
const COLLECTIONS = {
  products: ["image", "images", "description"],
  categories: ["image"],
  brands: ["logo", "bannerImage"],
  posts: ["image"],
  pages: ["image", "slides", "images", "sections"],
  subscribers: [],
  config: ["settings", "blog"],
};

// Helper to extract all URLs from a document
function extractUrls(doc) {
  const urls = [];
  const data = doc.data();

  function extractFromValue(val) {
    if (typeof val === "string" && val.includes("firebasestorage.googleapis.com")) {
      urls.push(val);
    } else if (Array.isArray(val)) {
      val.forEach((item) => {
        if (typeof item === "string" && item.includes("firebasestorage.googleapis.com")) {
          urls.push(item);
        } else if (typeof item === "object" && item !== null) {
          Object.values(item).forEach((v) => extractFromValue(v));
        }
      });
    } else if (typeof val === "object" && val !== null) {
      Object.values(val).forEach((v) => extractFromValue(v));
    }
  }

  Object.values(data).forEach(extractFromValue);
  return urls;
}

// Extract file path from Firebase Storage download URL
function extractFilePath(url) {
  // URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?alt=media
  const match = url.match(/\/o\/([^?]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

// Helper to extract URLs from nested page sections
function extractUrlsFromSections(doc) {
  const urls = [];
  const data = doc.data();

  function scan(obj) {
    if (!obj || typeof obj !== "object") return;

    if (typeof obj === "string" && obj.includes("firebasestorage.googleapis.com")) {
      urls.push(obj);
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(scan);
      return;
    }

    Object.values(obj).forEach(scan);
  }

  // Scan sections array if present
  if (data.sections && Array.isArray(data.sections)) {
    data.sections.forEach(scan);
  }

  // Scan hero config
  if (data.hero) scan(data.hero);

  return urls;
}

async function getAllReferencedPaths() {
  const referencedPaths = new Set();
  const referencedUrls = new Set();

  console.log("📚 Scanning Firestore collections...");

  // Scan products
  const productsSnap = await db.collection("products").get();
  console.log(`   products: ${productsSnap.size} documents`);
  productsSnap.forEach((doc) => {
    extractUrls(doc).forEach((url) => {
      referencedUrls.add(url);
      const path = extractFilePath(url);
      if (path) referencedPaths.add(path);
    });
  });

  // Scan categories
  const categoriesSnap = await db.collection("categories").get();
  console.log(`   categories: ${categoriesSnap.size} documents`);
  categoriesSnap.forEach((doc) => {
    extractUrls(doc).forEach((url) => {
      referencedUrls.add(url);
      const path = extractFilePath(url);
      if (path) referencedPaths.add(path);
    });
  });

  // Scan brands
  const brandsSnap = await db.collection("brands").get();
  console.log(`   brands: ${brandsSnap.size} documents`);
  brandsSnap.forEach((doc) => {
    extractUrls(doc).forEach((url) => {
      referencedUrls.add(url);
      const path = extractFilePath(url);
      if (path) referencedPaths.add(path);
    });
  });

  // Scan posts
  const postsSnap = await db.collection("posts").get();
  console.log(`   posts: ${postsSnap.size} documents`);
  postsSnap.forEach((doc) => {
    extractUrls(doc).forEach((url) => {
      referencedUrls.add(url);
      const path = extractFilePath(url);
      if (path) referencedPaths.add(path);
    });
  });

  // Scan pages (with nested sections)
  const pagesSnap = await db.collection("pages").get();
  console.log(`   pages: ${pagesSnap.size} documents`);
  pagesSnap.forEach((doc) => {
    extractUrls(doc).forEach((url) => {
      referencedUrls.add(url);
      const path = extractFilePath(url);
      if (path) referencedPaths.add(path);
    });
    extractUrlsFromSections(doc).forEach((url) => {
      referencedUrls.add(url);
      const path = extractFilePath(url);
      if (path) referencedPaths.add(path);
    });
  });

  // Scan config settings
  try {
    const settingsDoc = await db.collection("config").doc("settings").get();
    if (settingsDoc.exists) {
      extractUrls(settingsDoc).forEach((url) => {
        referencedUrls.add(url);
        const path = extractFilePath(url);
        if (path) referencedPaths.add(path);
      });
    }
  } catch (e) {
    // config/settings may not exist
  }

  // Scan blog config
  try {
    const blogDoc = await db.collection("config").doc("blog").get();
    if (blogDoc.exists) {
      extractUrls(blogDoc).forEach((url) => {
        referencedUrls.add(url);
        const path = extractFilePath(url);
        if (path) referencedPaths.add(path);
      });
    }
  } catch (e) {
    // config/blog may not exist
  }

  console.log(`\n✅ Total referenced URLs: ${referencedUrls.size}`);
  console.log(`✅ Total referenced file paths: ${referencedPaths.size}`);
  return { referencedUrls, referencedPaths };
}

async function getAllStorageFiles() {
  console.log("\n📦 Scanning Firebase Storage...");
  const files = [];

  const [allFiles] = await bucket.getFiles({ autoPaginate: true });

  for (const file of allFiles) {
    // Skip .well-known and metadata files
    if (file.name.startsWith(".well-known/")) continue;

    files.push({
      name: file.name,
      url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`,
    });
  }

  console.log(`   Total files in Storage: ${files.length}`);
  return files;
}

async function main() {
  console.log("🧹 Firebase Storage Cleanup Script");
  console.log("===================================");
  if (DRY_RUN) {
    console.log("⚠️  DRY RUN MODE - No files will be deleted\n");
  }

  const { referencedUrls, referencedPaths } = await getAllReferencedPaths();
  const storageFiles = await getAllStorageFiles();

  // Find orphaned files
  const orphanedFiles = [];

  for (const file of storageFiles) {
    // Check if this file's path or URL is referenced
    if (!referencedPaths.has(file.name) && !referencedUrls.has(file.url)) {
      orphanedFiles.push(file);
    }
  }

  console.log(`\n🔍 Results:`);
  console.log(`   Referenced files: ${storageFiles.length - orphanedFiles.length}`);
  console.log(`   Orphaned files: ${orphanedFiles.length}`);

  if (orphanedFiles.length === 0) {
    console.log("\n✅ No orphaned files found. Storage is clean!");
    return;
  }

  // Show orphaned files
  console.log("\n📋 Orphaned files:");
  let totalSize = 0;

  for (const file of orphanedFiles.slice(0, 50)) {
    const [metadata] = await bucket.file(file.name).getMetadata();
    const size = parseInt(metadata.size || "0");
    totalSize += size;
    console.log(`   ${file.name} (${(size / 1024).toFixed(1)} KB)`);
  }

  if (orphanedFiles.length > 50) {
    console.log(`   ... and ${orphanedFiles.length - 50} more files`);
  }

  console.log(`\n💾 Estimated space to free: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  if (DRY_RUN) {
    console.log("\n⚠️  Dry run complete. Run without --dry-run to delete files.");
    return;
  }

  // Confirm deletion
  console.log("\n🗑️  Deleting orphaned files...");

  let deleted = 0;
  let errors = 0;

  for (const file of orphanedFiles) {
    try {
      await bucket.file(file.name).delete();
      deleted++;
      process.stdout.write(`\r   Deleted: ${deleted}/${orphanedFiles.length}`);
    } catch (err) {
      errors++;
      console.error(`\n   Error deleting ${file.name}: ${err.message}`);
    }
  }

  console.log(`\n\n✅ Cleanup complete!`);
  console.log(`   Deleted: ${deleted} files`);
  if (errors > 0) {
    console.log(`   Errors: ${errors} files`);
  }
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});

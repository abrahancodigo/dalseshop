/**
 * Script to export Firestore data to JSON files
 * Run: node scripts/export-firebase.mjs
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccount) {
  console.error("❌ Set FIREBASE_SERVICE_ACCOUNT to the path of your Firebase service account JSON");
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(serviceAccount, "utf8"));
admin.initializeApp({ credential: admin.credential.cert(creds) });

const db = admin.firestore();

const COLLECTIONS = [
  "brands", "categories", "products", "reviews", "posts",
  "coupons", "pages", "subscribers", "orders", "customers",
  "users", "inventory_movements", "employees", "attendance_records",
  "payroll_periods", "loans",
];

// Sub-collections: config docs
const CONFIG_DOCS = [
  "settings", "theme", "features", "navigation", "shipping",
  "blog", "payroll", "orderCounter",
];

async function exportCollection(name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  const dir = "data";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(docs, null, 2));
  console.log(`  ${name}: ${docs.length} documents`);
}

async function exportConfigDocs() {
  const configs = {};
  for (const key of CONFIG_DOCS) {
    const snap = await db.collection("config").doc(key).get();
    if (snap.exists) {
      configs[key] = snap.data();
    }
  }
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(path.join("data", "config.json"), JSON.stringify(configs, null, 2));
  console.log(`  config: ${Object.keys(configs).length} documents`);
}

async function main() {
  console.log("Exporting Firestore data...\n");
  
  for (const name of COLLECTIONS) {
    await exportCollection(name);
  }
  await exportConfigDocs();
  
  console.log("\n✅ Export complete. Files saved to data/ directory.");
}

main().catch(console.error);

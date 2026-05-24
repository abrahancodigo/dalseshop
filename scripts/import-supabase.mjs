/**
 * Script to import JSON data into Supabase
 * Run: node scripts/import-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.SUPABASE_URL || "https://jqznkokxcdxqvosuwzdq.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxem5rb2t4Y2R4cXZvc3V3emRxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYzNzUyNSwiZXhwIjoyMDk1MjEzNTI1fQ.NtcXS1UxlqbZm2dLUffiaTCHJRukfRQl4-eb0-PuQ9A";

const supabase = createClient(supabaseUrl, supabaseKey);

// Field name mapping: Firestore → Supabase (snake_case)
const TABLE_MAP = {
  brands: { table: "brands", idField: "id" },
  categories: { table: "categories", idField: "id" },
  products: { table: "products", idField: "id" },
  reviews: { table: "reviews", idField: "id" },
  posts: { table: "posts", idField: "id" },
  coupons: { table: "coupons", idField: "id" },
  pages: { table: "pages", idField: "id" },
  subscribers: { table: "subscribers", idField: "id" },
  orders: { table: "orders", idField: "id" },
  customers: { table: "customers", idField: "id" },
  users: { table: "user_profiles", idField: "id" },
  inventory_movements: { table: "inventory_movements", idField: "id" },
  employees: { table: "employees", idField: "id" },
  attendance_records: { table: "attendance_records", idField: "id" },
  payroll_periods: { table: "payroll_periods", idField: "id" },
  loans: { table: "loans", idField: "id" },
};

// Field name mappings: Firestore field → Supabase field
const FIELD_MAP = {
  products: {
    comparePrice: "compare_price",
    isActive: "is_active",
    isFeatured: "is_featured",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  reviews: {
    productId: "product_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  posts: {
    coverImage: "cover_image",
    isPublished: "is_published",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  orders: {
    customerEmail: "customer_email",
    orderNumber: "order_number",
    shippingAddress: "shipping_address",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  customers: {
    totalOrders: "total_orders",
    lastOrderAt: "last_order_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  users: {
    displayName: "display_name",
    photoURL: "photo_url",
    customPermissions: "custom_permissions",
    isActive: "is_active",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  attendance_records: {
    employeeId: "employee_id",
    checkIn: "check_in",
    checkOut: "check_out",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  payroll_periods: {
    startDate: "start_date",
    endDate: "end_date",
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
  inventory_movements: {
    productId: "product_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  loans: {
    employeeId: "employee_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  employees: {
    hireDate: "hire_date",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  pages: {
    isPublished: "is_published",
    isHomePage: "is_home_page",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  coupons: {
    minPurchase: "min_purchase",
    isActive: "is_active",
    expiresAt: "expires_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  brands: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  categories: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  subscribers: {
    subscribedAt: "subscribed_at",
  },
};

function mapFields(collection, data) {
  const fieldMap = FIELD_MAP[collection] || {};
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "_id") {
      result["id"] = value;
      continue;
    }
    const mappedKey = fieldMap[key] || key;
    // Convert Firestore Timestamp to ISO string
    if (value && typeof value === "object" && value._seconds !== undefined) {
      result[mappedKey] = new Date(value._seconds * 1000).toISOString();
    } else if (value && typeof value === "object" && value.toDate) {
      result[mappedKey] = new Date(value.seconds * 1000).toISOString();
    } else {
      result[mappedKey] = value;
    }
  }
  return result;
}

async function importCollection(name) {
  const filePath = path.join("data", `${name}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`  ${name}: file not found, skipping`);
    return;
  }

  const docs = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (docs.length === 0) {
    console.log(`  ${name}: 0 documents, skipping`);
    return;
  }

  const table = TABLE_MAP[name]?.table || name;
  let imported = 0;
  let errors = 0;

  for (const doc of docs) {
    const mapped = mapFields(name, doc);
    const id = mapped.id;
    delete mapped.id;

    const { error } = await supabase
      .from(table)
      .upsert({ id, ...mapped }, { onConflict: "id" });

    if (error) {
      console.error(`  Error importing ${name}/${id}: ${error.message}`);
      errors++;
    } else {
      imported++;
    }
  }

  console.log(`  ${name}: ${imported} imported, ${errors} errors (${docs.length} total)`);
}

async function importConfig() {
  const filePath = path.join("data", "config.json");
  if (!fs.existsSync(filePath)) return;

  const configs = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(configs)) {
    const { error } = await supabase
      .from("config")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) console.error(`  Error importing config/${key}: ${error.message}`);
    else console.log(`  config/${key}: imported`);
  }
}

async function main() {
  console.log("Importing data to Supabase...\n");

  const collections = Object.keys(TABLE_MAP);
  for (const name of collections) {
    await importCollection(name);
  }
  await importConfig();

  console.log("\n✅ Import complete.");
}

main().catch(console.error);

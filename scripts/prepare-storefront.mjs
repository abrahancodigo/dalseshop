// Public visual content only. Prices, stock and customer data are never snapshotted.
import "./build-policy.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const destination = path.join(root, "src/data/storefront-bootstrap.json");
const config = await fs.readFile(path.join(root, "src/lib/firebase.jsx"), "utf8");
const projectId = config.match(/projectId:\s*"([^"]+)"/)[1];
const apiKey = config.match(/apiKey:\s*"([^"]+)"/)[1];
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const decode = (v) => v.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]))
  : v.arrayValue ? (v.arrayValue.values || []).map(decode) : v.timestampValue ? { seconds: Date.parse(v.timestampValue) / 1000 }
    : v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue ?? v.stringValue ?? v.booleanValue ?? null;
async function request(url, body) {
  const response = await fetch(`${url}?key=${apiKey}`, { signal: AbortSignal.timeout(15000), ...(body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`Public storefront: HTTP ${response.status}`);
  return response.json();
}
async function collection(name, filters = []) {
  const structuredQuery = { from: [{ collectionId: name }] };
  if (filters.length) structuredQuery.where = { compositeFilter: { op: "AND", filters: filters.map((fieldPath) => ({ fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { booleanValue: true } } })) } };
  const result = await request(`${base}:runQuery`, { structuredQuery });
  return result.filter((r) => r.document).map(({ document }) => ({ id: document.name.split("/").at(-1), ...decode({ mapValue: { fields: document.fields } }) }));
}
const pick = (value, keys) => Object.fromEntries(keys.filter((k) => value[k] !== undefined).map((k) => [k, value[k]]));
try {
  const [pages, brands, categories, ...configs] = await Promise.all([
    collection("pages", ["isHomePage", "isPublished"]), collection("brands"), collection("categories"),
    ...["settings", "theme", "features", "navigation"].map(async (name) => decode({ mapValue: { fields: (await request(`${base}/config/${name}`)).fields } })),
  ]);
  const home = pages.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))[0];
  if (!home?.sections?.length) throw new Error("No published homepage was found");
  const [settings, theme, features, navigation] = configs;
  const snapshot = {
    projectId, generatedAt: new Date().toISOString(), home: pick(home, ["id", "title", "sections"]),
    store: {
      settings: pick(settings, ["name", "slogan", "description", "logo", "favicon", "email", "phone", "address", "legalInfo", "seo", "socialMedia"]),
      theme, features, navigation,
      brands: brands.sort((a, b) => (a.order || 0) - (b.order || 0)).map((brand) => pick(brand, ["id", "name", "logo", "bannerImage", "order", "isActive"])),
      categories: categories.sort((a, b) => (a.order || 0) - (b.order || 0)).map((category) => pick(category, ["id", "name", "slug", "image", "order", "isActive"])),
    },
  };
  await fs.writeFile(destination, JSON.stringify(snapshot) + "\n");
  console.log(`Prepared original homepage (${home.sections.length} sections), branding and navigation`);
} catch (error) {
  const cached = JSON.parse(await fs.readFile(destination, "utf8").catch(() => "{}"));
  if (cached.projectId !== projectId || !cached.home?.sections?.length) throw error;
  console.warn(`${error.message}; using the prepared snapshot from ${cached.generatedAt}. Live data still revalidates in the browser.`);
}

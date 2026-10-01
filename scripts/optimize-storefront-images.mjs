// Reads only public storefront documents and creates local assets. Never writes to Firebase.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { readResponsiveImage } from "../src/lib/responsiveImage.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = await fs.readFile(path.join(root, "src/lib/firebase.jsx"), "utf8");
const apiKey = source.match(/apiKey:\s*"([^"]+)"/)[1];
const project = source.match(/projectId:\s*"([^"]+)"/)[1];
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
sharp.concurrency(1);

async function request(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

function decode(value) {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, v]) => [key, decode(v)]));
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.timestampValue) return { seconds: Date.parse(value.timestampValue) / 1000 };
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  return value.stringValue ?? value.booleanValue ?? null;
}

async function query(collectionId, filters = []) {
  const body = { structuredQuery: { from: [{ collectionId }] } };
  if (filters.length) body.structuredQuery.where = { compositeFilter: { op: "AND", filters: filters.map(([fieldPath, value]) => ({ fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { booleanValue: value } } })) } };
  const response = await request(`${base}:runQuery?key=${apiKey}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await response.json()).filter((row) => row.document).map(({ document }) => decode({ mapValue: { fields: document.fields } }));
}

const [homepages, products, brands, settingsResponse] = await Promise.all([
  query("pages", [["isHomePage", true], ["isPublished", true]]),
  query("products", [["isActive", true]]),
  query("brands"),
  request(`${base}/config/settings?key=${apiKey}`),
]);
const settings = decode({ mapValue: { fields: (await settingsResponse.json()).fields } });
const images = new Map();
const addImage = (url, kind) => {
  if (readResponsiveImage(url)) return;
  if (typeof url !== "string" || !url.startsWith("https://firebasestorage.googleapis.com/")) return;
  if (!images.has(url) || kind === "banner") images.set(url, kind);
};
for (const homepage of homepages) {
  for (const section of homepage.sections || []) {
    addImage(section.config?.image, "banner");
    for (const slide of section.config?.slides || []) addImage(slide.image, "banner");
    for (const image of section.config?.images || []) addImage(image, "banner");
  }
}
for (const product of products) for (const image of product.images || []) addImage(image, "product");
for (const brand of brands) { addImage(brand.logo, "logo"); addImage(brand.bannerImage, "banner"); }
addImage(settings.logo, "logo");

const output = path.join(root, "public/optimized-images");
await fs.mkdir(output, { recursive: true });
const manifestPath = path.join(root, "src/data/image-manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8").catch(() => "{}"));
let originalBytes = 0;
let largestVariantBytes = 0;
let completed = 0;
let failed = 0;
let cached = 0;
console.log(`Optimizing ${images.size} public storefront images`);

async function optimize([url, kind]) {
  try {
    const existing = manifest[url];
    if (existing && !process.argv.includes("--refresh")) {
      try {
        await Promise.all(existing.variants.map((variant) => fs.access(path.join(root, "public", variant.src))));
        cached++;
        return;
      } catch { /* Regenerate missing files. */ }
    }
    const buffer = Buffer.from(await (await request(url)).arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1) return;
    const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const oriented = metadata.orientation >= 5 && metadata.orientation <= 8;
    const width = oriented ? metadata.height : metadata.width;
    const height = oriented ? metadata.width : metadata.height;
    const targets = kind === "banner" ? [160, 480, 960, 1440, 1920] : kind === "logo" ? [96, 192, 384] : [160, 320, 640, 960];
    const widths = [...new Set(targets.map((target) => Math.min(target, width)))].sort((a, b) => a - b);
    const variants = [];
    for (const target of widths) {
      const filename = `${hash}-${target}.webp`;
      const dest = path.join(output, filename);
      let size;
      try { size = (await fs.stat(dest)).size; }
      catch {
        const info = await sharp(buffer).rotate().resize({ width: target, withoutEnlargement: true }).webp({ quality: kind === "banner" ? 88 : 84, effort: 4 }).toFile(dest);
        size = info.size;
      }
      variants.push({ width: target, src: `/optimized-images/${filename}`, bytes: size });
    }
    manifest[url] = { width, height, src: variants.at(-1).src, variants };
    originalBytes += buffer.length;
    largestVariantBytes += variants.at(-1).bytes;
    completed++;
    if (completed % 15 === 0 || kind === "banner") console.log(`${completed}/${images.size}: ${kind}, ${width}×${height}, ${buffer.length} → ${variants.at(-1).bytes} bytes`);
  } catch (error) { failed++; console.warn(`Image ${crypto.createHash("sha256").update(url).digest("hex").slice(0, 8)}: ${error.message}; keeping original fallback`); }
}

const queue = process.argv.includes("--fonts-only") ? [] : [...images];
async function worker() { while (queue.length) await optimize(queue.shift()); }
await Promise.all([worker(), worker()]);
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ completed, cached, failed, originalBytes, largestVariantBytes, reduction: originalBytes ? `${Math.round((1 - largestVariantBytes / originalBytes) * 100)}%` : "0%" }));

// Serve the same Inter family locally, with a variable font covering all existing weights.
const fontDir = path.join(root, "public/fonts");
await fs.mkdir(fontDir, { recursive: true });
const fontCSS = await (await request("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap", { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } })).text();
const faces = fontCSS.match(/\/\* latin(?:-ext)? \*\/[\s\S]*?\}/g) || [];
if (!faces.length) throw new Error("Inter Latin font subsets were not found");
const localFaces = [];
let latinFont;
for (const face of faces) {
  const remoteURL = face.match(/url\((https:[^)]+)\)/)[1];
  const buffer = Buffer.from(await (await request(remoteURL)).arrayBuffer());
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const filename = `inter-${hash}.woff2`;
  await fs.writeFile(path.join(fontDir, filename), buffer);
  localFaces.push(face.replace(remoteURL, `/fonts/${filename}`));
  if (face.startsWith("/* latin */")) latinFont = `/fonts/${filename}`;
}
await fs.writeFile(path.join(root, "src/app/fonts.css"), localFaces.join("\n\n") + "\n");
const license = await (await request("https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt")).text();
await fs.writeFile(path.join(fontDir, "Inter-LICENSE.txt"), license);
if (latinFont) {
  const indexPath = path.join(root, "index.html");
  const index = await fs.readFile(indexPath, "utf8");
  const preload = `<link data-storefont rel="preload" href="${latinFont}" as="font" type="font/woff2" crossorigin />`;
  const updated = index.includes("data-storefont") ? index.replace(/<link data-storefont[^>]+>/, preload) : index.replace("    <title>", `    ${preload}\n    <title>`);
  await fs.writeFile(indexPath, updated);
}
console.log("Inter Latin and Latin Extended fonts saved locally");

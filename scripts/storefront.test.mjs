import test from "node:test";
import assert from "node:assert/strict";
import { createQueryCache } from "../src/lib/queryCache.mjs";
import { filterProducts, normalizeProductOptions } from "../src/lib/productFilters.mjs";
import { readResponsiveImage, withResponsiveMetadata, imageURLWithoutMetadata, isReferencedVariant } from "../src/lib/responsiveImage.mjs";
import { spawnSync } from "node:child_process";
import { swipeStep, slideDistance } from "../src/lib/carousel.mjs";

test("concurrent catalog readers share a request, expire and retry failures", async () => {
  let now = 0, loads = 0;
  const cache = createQueryCache({ ttl: 10, now: () => now });
  const load = async () => ++loads;
  assert.deepEqual(await Promise.all([cache.get("a", load), cache.get("a", load)]), [1, 1]);
  now = 9; assert.equal(await cache.get("a", load), 1);
  now = 10; assert.equal(await cache.get("a", load), 2);
  await assert.rejects(cache.get("b", () => Promise.reject(new Error("offline"))));
  assert.equal(await cache.get("b", load), 3);
});

test("a product edit prevents an older in-flight read from repopulating the cache", async () => {
  const cache = createQueryCache();
  let finish;
  const old = cache.get("products", () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  cache.clear();
  assert.equal(await cache.get("products", async () => "updated"), "updated");
  finish("old"); await old;
  assert.equal(await cache.get("products", async () => "unexpected"), "updated");
});

test("catalog filters combine category, brand and codes before applying the limit", () => {
  const products = [
    { id: 1, isActive: true, category: "a", brand: "b", sku: "ABC-12" },
    { id: 2, isActive: false, category: "a", brand: "b", sku: "ABC-12" },
    { id: 3, isActive: true, category: "c", brand: "b", barcode: "12" },
    { id: 4, isActive: true, category: "a", brand: "b", barcode: "12" },
  ];
  const options = { isActive: true, category: "a", brand: "b", productCodes: [" 12 ", "12"], limitCount: 1 };
  assert.deepEqual(filterProducts(products, options).map((p) => p.id), [1]);
  assert.deepEqual(normalizeProductOptions(options).productCodes, ["12"]);
  assert.doesNotThrow(() => normalizeProductOptions({ productCodes: "invalid" }));
});

test("new upload metadata reconstructs usable variant URLs and preserves the original", () => {
  for (const origin of ["https://firebasestorage.googleapis.com", "http://localhost:9199"]) {
    const src = `${origin}/v0/b/test.appspot.com/o/products%2Fimage%20name.png?alt=media&token=original-token`;
    const encoded = withResponsiveMetadata(src, 1200, 800, [{ width: 480, url: `${origin}/v0/b/test.appspot.com/o/products%2Fimage%20name.png.responsive%2F480.webp?alt=media&token=small-token` }]);
    const result = readResponsiveImage(encoded);
    assert.equal(result.width, 1200); assert.equal(result.height, 800);
    assert.equal(new URL(result.src).searchParams.get("token"), "small-token");
    assert.equal(decodeURIComponent(new URL(result.src).pathname), "/v0/b/test.appspot.com/o/products/image name.png.responsive/480.webp");
    assert.equal(imageURLWithoutMetadata(encoded), src);
  }
});

test("malformed and untrusted image metadata falls back to the original", () => {
  assert.equal(readResponsiveImage("https://example.org/image.png#dsi=broken"), null);
  assert.equal(readResponsiveImage("data:image/png#dsi=%7B%7D"), null);
  const invalid = withResponsiveMetadata("https://example.org/v0/b/test/o/file.png", 100, 100, [{ width: 2000, url: "https://example.org/?token=test" }]);
  assert.equal(readResponsiveImage(invalid), null);
});

test("vertical gestures keep page scrolling while horizontal gestures wrap the carousel", () => {
  assert.equal(swipeStep(-90, 10, 375), 1);
  assert.equal(swipeStep(90, 10, 375), -1);
  assert.equal(swipeStep(40, 100, 375), 0);
  assert.equal(swipeStep(5, 0, 375), 0);
  assert.equal(slideDistance(4, 0, 5), -1);
  assert.equal(slideDistance(0, 4, 5), 1);
});

test("storage cleanup keeps variants only when their exact original is referenced", () => {
  const references = new Set(["products/a.png"]);
  assert.equal(isReferencedVariant("products/a.png.responsive/480.webp", references), true);
  assert.equal(isReferencedVariant("products/a.png-old.responsive/480.webp", references), false);
  assert.equal(isReferencedVariant("products/unused.png.responsive/480.webp", references), false);
  assert.equal(isReferencedVariant("products/a.png", references), false);
});

test("the review branch refuses an automatic Cloudflare build", () => {
  const result = spawnSync(process.execPath, [new URL("./build-policy.mjs", import.meta.url).pathname], {
    env: { ...process.env, WORKERS_CI: "1", WORKERS_CI_BRANCH: "improve/storefront-performance" }, encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Deployment is disabled/);
});

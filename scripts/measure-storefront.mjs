import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { gzipSync } from "node:zlib";
import { chromium, devices } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
async function serve(directory) {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      let filename = path.resolve(directory, `.${pathname}`);
      if (!filename.startsWith(directory + path.sep) && filename !== directory) { response.writeHead(403).end(); return; }
      if (!(await fs.stat(filename).catch(() => null))?.isFile()) filename = path.join(directory, "index.html");
      const type = mime[path.extname(filename)] || "application/octet-stream";
      let data = await fs.readFile(filename);
      const headers = { "content-type": type, "cache-control": "no-store" };
      if (/text|javascript|json|svg/.test(type) && request.headers["accept-encoding"]?.includes("gzip")) { data = gzipSync(data); headers["content-encoding"] = "gzip"; }
      response.writeHead(200, headers).end(data);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function initialJavaScript(directory) {
  const html = await fs.readFile(path.join(directory, "index.html"), "utf8");
  const files = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.js)"/g)].map((match) => match[1]))];
  let bytes = 0, gzipBytes = 0;
  for (const file of files) { const data = await fs.readFile(path.join(directory, file)); bytes += data.length; gzipBytes += gzipSync(data).length; }
  return { files, bytes, gzipBytes };
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const report = { environment: { browser: await browser.version(), device: "Pixel 7 emulation", latencyMs: 150, downloadBytesPerSecond: 200000, cpuSlowdown: 4, compression: "gzip", coldCache: true, runsPerBuild: 3, note: "Local laboratory measurements, not a physical phone or field/Lighthouse results." }, builds: [] };
try {
  const builds = [...(process.argv[2] ? [{ name: "before", directory: path.resolve(process.argv[2]) }] : []), { name: "after", directory: path.join(root, "dist") }];
  for (const build of builds) {
    const server = await serve(build.directory);
    const runs = [];
    try {
      for (let run = 1; run <= 3; run++) {
        const context = await browser.newContext({ ...devices["Pixel 7"], ignoreHTTPSErrors: true });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript(() => {
          window.__measure = { lcp: 0, cls: 0 };
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__measure.lcp = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__measure.cls += entry.value; }).observe({ type: "layout-shift", buffered: true });
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 90000 });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(server.url, { waitUntil: "domcontentloaded", timeout: 60000 });
        let heroReadyMs = null;
        try {
          await page.waitForFunction(() => {
            const image = document.querySelector('[aria-label="Promociones de la tienda"] img[fetchpriority="high"]');
            return image?.complete && image.naturalWidth > 0;
          }, undefined, { timeout: 30000 });
          heroReadyMs = await page.evaluate(() => performance.now());
        } catch { /* Report a missing hero explicitly. */ }
        await page.waitForTimeout(2000);
        const measurements = await page.evaluate(() => ({ ...window.__measure, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime || null, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }));
        const result = { run, heroReadyMs, ...measurements, errors };
        runs.push(result);
        console.log(JSON.stringify({ build: build.name, ...result }));
        if (build.name === "after" && run === 1) { await fs.mkdir(path.join(root, "test-results"), { recursive: true }); await page.screenshot({ path: path.join(root, "test-results/mobile-storefront.png") }); }
        await context.close();
      }
    } finally { await server.close(); }
    report.builds.push({ name: build.name, initialJavaScript: await initialJavaScript(build.directory), runs });
  }
  await fs.writeFile(path.join(root, "docs/performance-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("Saved docs/performance-report.json");
} finally { await browser.close(); }

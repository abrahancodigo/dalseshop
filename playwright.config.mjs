import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  expect: { timeout: 12000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure",
    launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --mode localdev --host 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100", reuseExistingServer: !process.env.CI,
  },
});

import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const base = process.env.DATABASE_URL ?? "postgresql://myminijob:myminijob@localhost:5432/myminijob";
const e2eDb = new URL(base);
e2eDb.pathname = "/myminijob_e2e";
export const E2E_DATABASE_URL = e2eDb.toString();

/** E2E against the production build (`next build` first). Uses its own database with demo seed. */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx tsx e2e/prepare-db.ts && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
      ALLOW_LOCAL_STORAGE: "1",
      STORAGE_DIR: "/tmp/mmj-e2e-storage",
      PAYMENT_PROVIDER: "test",
      REDIS_URL: "",
    },
  },
});

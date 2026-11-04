import { execFileSync } from "node:child_process";
import path from "node:path";
import pg from "pg";
import { E2E_DATABASE_URL } from "../playwright.config";

/** Run before the E2E web server starts: fresh database with demo seed. */
async function setup() {
  const maintenance = new URL(E2E_DATABASE_URL);
  maintenance.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: maintenance.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'myminijob_e2e'");
  if (!exists.rowCount) await admin.query("CREATE DATABASE myminijob_e2e");
  await admin.end();
  const dbDir = path.resolve(import.meta.dirname, "../../../packages/db");
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, SEED_DEMO: "1", NODE_ENV: "test" as const };
  const tsx = path.join(dbDir, "node_modules/.bin/tsx");
  execFileSync(tsx, ["scripts/migrate.ts", "--reset"], { cwd: dbDir, env, stdio: "pipe" });
  execFileSync(tsx, ["scripts/seed.ts"], { cwd: dbDir, env, stdio: "pipe" });
}

setup().catch((e) => {
  console.error(e);
  process.exit(1);
});

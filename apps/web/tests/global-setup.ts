import { execFileSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

/** Creates a dedicated test database, applies all migrations and seeds reference data (no demo data). */
export default async function setup() {
  const base = process.env.DATABASE_URL ?? "postgresql://myminijob:myminijob@localhost:5432/myminijob";
  const url = new URL(base);
  const testDb = process.env.TEST_DATABASE_NAME ?? "myminijob_test";
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testDb]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE ${testDb}`);
  await admin.end();
  url.pathname = `/${testDb}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), SEED_DEMO: "0", NODE_ENV: "test" as const };
  const dbDir = path.resolve(__dirname, "../../../packages/db");
  const tsx = path.join(dbDir, "node_modules/.bin/tsx");
  execFileSync(tsx, ["scripts/migrate.ts", "--reset"], { cwd: dbDir, env, stdio: "pipe" });
  execFileSync(tsx, ["scripts/seed.ts"], { cwd: dbDir, env, stdio: "pipe" });
  process.env.TEST_DATABASE_URL = url.toString();
}

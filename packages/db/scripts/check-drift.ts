/**
 * Drift check: builds a scratch DB from schema.prisma (via schema-to-sql.mjs) and another
 * from the migrations, then compares tables, columns, types, nullability and indexes.
 * Exit code 1 on drift. Runs in CI.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrate } from "./migrate";

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.DATABASE_URL!;
const withDb = (name: string) => {
  const u = new URL(base);
  u.pathname = `/${name}`;
  return u.toString();
};

async function describe(url: string) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const cols = await c.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY 1,2`);
  const idx = await c.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY 1`);
  await c.end();
  return {
    cols: cols.rows.map((r) => `${r.table_name}.${r.column_name} ${r.udt_name} ${r.is_nullable} ${r.column_default ?? ""}`),
    idx: idx.rows.map((r) => r.indexname as string),
  };
}

async function main() {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  for (const n of ["mmj_drift_schema", "mmj_drift_migr"]) {
    await admin.query(`DROP DATABASE IF EXISTS ${n}`);
    await admin.query(`CREATE DATABASE ${n}`);
  }
  await admin.end();

  const ddl = execFileSync("node", [path.join(here, "schema-to-sql.mjs"), path.join(here, "..", "prisma", "schema.prisma")], { encoding: "utf8" });
  const s = new pg.Client({ connectionString: withDb("mmj_drift_schema") });
  await s.connect();
  await s.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;" + ddl);
  await s.end();
  await migrate({ url: withDb("mmj_drift_migr"), quiet: true });

  const a = await describe(withDb("mmj_drift_schema"));
  const b = await describe(withDb("mmj_drift_migr"));
  const missing = a.cols.filter((x) => !b.cols.includes(x));
  const extra = b.cols.filter((x) => !a.cols.includes(x));
  const missingIdx = a.idx.filter((x) => !b.idx.includes(x));
  if (missing.length || extra.length || missingIdx.length) {
    console.error("Schema-Drift gefunden!");
    for (const m of missing) console.error("  fehlt in Migrationen:", m);
    for (const m of extra) console.error("  nur in Migrationen:   ", m);
    for (const m of missingIdx) console.error("  Index fehlt:          ", m);
    process.exit(1);
  }
  console.log(`Kein Drift: ${a.cols.length} Spalten, ${b.idx.length} Indizes geprüft.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

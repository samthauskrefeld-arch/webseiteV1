/**
 * Applies SQL migrations from prisma/migrations in order.
 * Bookkeeping uses Prisma's own `_prisma_migrations` table and checksum format, so
 * `prisma migrate deploy` / `prisma migrate status` remain compatible.
 *
 *   tsx scripts/migrate.ts            apply pending migrations
 *   tsx scripts/migrate.ts --status   list applied/pending
 *   tsx scripts/migrate.ts --reset    DROP SCHEMA public CASCADE, then apply all (dev/test only)
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "prisma", "migrations");

export async function migrate(opts: { url?: string; reset?: boolean; statusOnly?: boolean; quiet?: boolean } = {}) {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt");
  const log = (m: string) => !opts.quiet && console.log(m);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (opts.reset) {
      if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DB_RESET) throw new Error("Reset in production verweigert");
      await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
      log("Schema zurückgesetzt.");
    }
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
    const applied = new Map<string, string>(
      (await client.query(`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows.map((r) => [r.migration_name, r.checksum]),
    );
    const dirs = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    let count = 0;
    for (const name of dirs) {
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      if (applied.has(name)) {
        if (applied.get(name) !== checksum) throw new Error(`Migration ${name} wurde nach dem Anwenden verändert (Checksumme weicht ab).`);
        if (opts.statusOnly) log(`✔ ${name}`);
        continue;
      }
      if (opts.statusOnly) {
        log(`… ${name} (ausstehend)`);
        continue;
      }
      const id = randomUUID();
      await client.query("BEGIN");
      try {
        await client.query(`INSERT INTO "_prisma_migrations" (id, checksum, migration_name) VALUES ($1, $2, $3)`, [id, checksum, name]);
        await client.query(sql);
        await client.query(`UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`, [id]);
        await client.query("COMMIT");
        log(`✔ angewendet: ${name}`);
        count++;
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${name} fehlgeschlagen: ${(e as Error).message}`);
      }
    }
    if (!opts.statusOnly) log(count ? `${count} Migration(en) angewendet.` : "Datenbank ist aktuell.");
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  migrate({ reset: process.argv.includes("--reset"), statusOnly: process.argv.includes("--status") }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

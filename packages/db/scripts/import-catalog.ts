/**
 * Versioned import of the qualification catalog.
 *
 *   pnpm --filter @myminijob/db import-catalog -- --file data/x.csv --version bibb-2026.1 \
 *        --source "BIBB Verzeichnis der anerkannten Ausbildungsberufe" --license "<Lizenz laut Quelle>"
 *
 * CSV format (semicolon separated, UTF-8, header row):
 *   kind;name;official;aliases
 *   kind     = AUSBILDUNGSBERUF | BERUF | STUDIENFACH | MEISTER_FORTBILDUNG | ZERTIFIKAT
 *   official = 1 if the name is an officially regulated designation
 *   aliases  = "Alias:KIND|Alias2:KIND" with KIND = SYNONYM | ABBREVIATION | SPELLING | COLLOQUIAL
 *
 * Existing qualification IDs are preserved (matched on kind + normalised name) so every profile
 * and listing keeps pointing at the same qualification_id across catalog versions. Entries of the
 * same source that are missing from a new version are deactivated, never deleted.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeText, QUALIFICATION_KINDS } from "@myminijob/core";
import type { PrismaClient } from "../src/generated/client";

const ALIAS_KINDS = ["SYNONYM", "ABBREVIATION", "SPELLING", "COLLOQUIAL"] as const;

export interface CatalogRow {
  kind: (typeof QUALIFICATION_KINDS)[number];
  name: string;
  official: boolean;
  aliases: Array<{ alias: string; kind: (typeof ALIAS_KINDS)[number] }>;
}

export function parseCatalogCsv(csv: string): CatalogRow[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift()?.split(";").map((h) => h.trim());
  if (header?.join(";") !== "kind;name;official;aliases") throw new Error("Unerwarteter CSV-Header");
  return lines.map((line, i) => {
    const [kind, name, official, aliases = ""] = line.split(";");
    if (!QUALIFICATION_KINDS.includes(kind as CatalogRow["kind"])) throw new Error(`Zeile ${i + 2}: unbekannte Art ${kind}`);
    if (!name?.trim()) throw new Error(`Zeile ${i + 2}: Name fehlt`);
    return {
      kind: kind as CatalogRow["kind"],
      name: name.trim(),
      official: official === "1",
      aliases: aliases
        .split("|")
        .filter(Boolean)
        .map((a) => {
          const idx = a.lastIndexOf(":");
          const k = a.slice(idx + 1) as (typeof ALIAS_KINDS)[number];
          if (!ALIAS_KINDS.includes(k)) throw new Error(`Zeile ${i + 2}: Alias-Art ${k} ungültig`);
          return { alias: a.slice(0, idx).trim(), kind: k };
        }),
    };
  });
}

export async function importCatalog(
  prisma: PrismaClient,
  opts: { csv: string; version: string; source: string; license: string; notes?: string; log?: (m: string) => void },
) {
  const log = opts.log ?? console.log;
  const checksum = createHash("sha256").update(opts.csv).digest("hex");
  const existingImport = await prisma.catalogImport.findUnique({ where: { version: opts.version } });
  if (existingImport) {
    if (existingImport.checksum !== checksum) throw new Error(`Version ${opts.version} existiert bereits mit anderem Inhalt – neue Versionsnummer verwenden.`);
    log(`Katalog ${opts.version} ist bereits importiert.`);
    return { created: 0, updated: 0, deactivated: 0 };
  }
  const rows = parseCatalogCsv(opts.csv);
  let created = 0;
  let updated = 0;
  const seen = new Set<string>();
  await prisma.$transaction(
    async (tx) => {
      for (const row of rows) {
        const normalizedName = normalizeText(row.name);
        seen.add(`${row.kind}|${normalizedName}`);
        const existing = await tx.qualification.findUnique({ where: { kind_normalizedName: { kind: row.kind, normalizedName } } });
        const q = existing
          ? await tx.qualification.update({ where: { id: existing.id }, data: { name: row.name, isOfficial: row.official, active: true, catalogVersion: opts.version, source: opts.source } })
          : await tx.qualification.create({ data: { kind: row.kind, name: row.name, normalizedName, isOfficial: row.official, source: opts.source, catalogVersion: opts.version } });
        existing ? updated++ : created++;
        for (const a of row.aliases) {
          const normalizedAlias = normalizeText(a.alias);
          if (!normalizedAlias || normalizedAlias === normalizedName) continue;
          await tx.qualificationAlias.upsert({
            where: { qualificationId_normalizedAlias: { qualificationId: q.id, normalizedAlias } },
            create: { qualificationId: q.id, alias: a.alias, normalizedAlias, kind: a.kind },
            update: { alias: a.alias, kind: a.kind },
          });
        }
      }
      const sameSource = await tx.qualification.findMany({ where: { source: opts.source, active: true }, select: { id: true, kind: true, normalizedName: true } });
      const stale = sameSource.filter((q) => !seen.has(`${q.kind}|${q.normalizedName}`)).map((q) => q.id);
      if (stale.length) await tx.qualification.updateMany({ where: { id: { in: stale } }, data: { active: false } });
      await tx.catalogImport.create({ data: { version: opts.version, source: opts.source, license: opts.license, recordCount: rows.length, checksum, notes: opts.notes } });
      log(`Katalog ${opts.version}: ${created} neu, ${updated} aktualisiert, ${stale.length} deaktiviert.`);
    },
    { timeout: 120_000 },
  );
  return { created, updated };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  const file = arg("file");
  const version = arg("version");
  const source = arg("source");
  const license = arg("license");
  if (!file || !version || !source || !license) {
    console.error("Benötigt: --file --version --source --license");
    process.exit(1);
  }
  const { getPrisma } = await import("../src/index");
  const prisma = getPrisma();
  importCatalog(prisma, { csv: fs.readFileSync(file, "utf8"), version, source, license })
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e.message);
      await prisma.$disconnect();
      process.exit(1);
    });
}

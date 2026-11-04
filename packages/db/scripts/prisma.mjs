/**
 * Wrapper around the Prisma CLI for `generate` / `validate`.
 * These commands only need Prisma's bundled WASM modules. If the native schema-engine
 * binary cannot be downloaded (offline/firewalled CI), a placeholder path is supplied so the
 * CLI does not abort. Migrations are applied by scripts/migrate.ts, which does not need
 * the native engine either.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
if (!env.PRISMA_SCHEMA_ENGINE_BINARY) {
  const placeholder = path.join(os.tmpdir(), "mmj-schema-engine-placeholder");
  if (!fs.existsSync(placeholder)) fs.writeFileSync(placeholder, "#!/bin/sh\necho 'placeholder'\n", { mode: 0o755 });
  env.PRISMA_SCHEMA_ENGINE_BINARY = placeholder;
}
env.PRISMA_HIDE_UPDATE_MESSAGE = "1";
const bin = path.join(here, "..", "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const r = spawnSync(bin, process.argv.slice(2), { stdio: "inherit", env, cwd: path.join(here, "..") });
process.exit(r.status ?? 1);

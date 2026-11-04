import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";

const globalForPrisma = globalThis as unknown as { __mmjPrisma?: PrismaClient };

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL ist nicht gesetzt");
  const adapter = new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
  return new PrismaClient({ adapter, log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"] });
}

/** Process-wide singleton (survives Next.js hot reloads in development). */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__mmjPrisma) globalForPrisma.__mmjPrisma = createPrismaClient();
  return globalForPrisma.__mmjPrisma;
}

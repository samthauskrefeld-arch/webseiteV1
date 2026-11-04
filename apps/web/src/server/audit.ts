import "server-only";
import type { Tx } from "./db";
import { db } from "./db";

/** Append-only audit trail for security- and money-relevant actions. Never log secrets or full PII. */
export async function audit(
  entry: { actorId?: string | null; action: string; entityType: string; entityId?: string | null; data?: Record<string, unknown> },
  tx?: Tx,
) {
  const client = tx ?? db();
  await client.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      data: (entry.data ?? {}) as object,
    },
  });
}

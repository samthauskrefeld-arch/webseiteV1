import "server-only";
import { LIMITS } from "@myminijob/core";
import type { AiUsageInfo } from "../adapters/ai";
import { aiEnabled } from "../adapters/ai";
import { db } from "../db";

/** Daily request budget per user/IP – cost control for the LLM. */
export async function aiBudgetAvailable(clientKey: string, userId?: string | null) {
  if (!aiEnabled()) return false;
  const since = new Date(Date.now() - 86400_000);
  const used = await db().aiUsage.count({ where: { clientKey, createdAt: { gte: since } } });
  return used < (userId ? LIMITS.aiDailyRequestsPerUser : LIMITS.aiDailyRequestsAnonymous);
}

export async function recordAiUsage(clientKey: string, userId: string | null | undefined, usage: AiUsageInfo) {
  await db().aiUsage.create({ data: { clientKey, userId: userId ?? null, provider: "anthropic", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } });
}

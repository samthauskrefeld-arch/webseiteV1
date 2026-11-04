import "server-only";
import { ApiError } from "./errors";
import { getRedis } from "./adapters/redis";

const memory = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window rate limiter. Uses Redis when configured (shared across instances),
 * otherwise an in-process map (single instance / development).
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ remaining: number }> {
  const redis = getRedis();
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  let count: number;
  if (redis) {
    try {
      count = await redis.incr(bucket);
      if (count === 1) await redis.expire(bucket, windowSec + 1);
    } catch {
      count = memoryIncr(bucket, windowSec);
    }
  } else {
    count = memoryIncr(bucket, windowSec);
  }
  if (count > limit) throw new ApiError("RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es gleich noch einmal.");
  return { remaining: limit - count };
}

function memoryIncr(bucket: string, windowSec: number) {
  const now = Date.now();
  const e = memory.get(bucket);
  if (!e || e.resetAt < now) {
    memory.set(bucket, { count: 1, resetAt: now + windowSec * 1000 });
    if (memory.size > 50_000) for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
    return 1;
  }
  e.count++;
  return e.count;
}

export function resetRateLimitsForTests() {
  memory.clear();
}

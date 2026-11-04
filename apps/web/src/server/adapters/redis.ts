import "server-only";
import Redis from "ioredis";

const g = globalThis as unknown as { __mmjRedis?: Redis | null };

/** Returns a shared Redis client, or null when REDIS_URL is not configured. */
export function getRedis(): Redis | null {
  if (g.__mmjRedis !== undefined) return g.__mmjRedis;
  const url = process.env.REDIS_URL;
  if (!url) {
    g.__mmjRedis = null;
    return null;
  }
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
  client.on("error", () => {
    /* connection errors are handled by callers (fallbacks) */
  });
  g.__mmjRedis = client;
  return client;
}

/** Publishes a realtime event for apps/realtime. Silently skipped without Redis (clients poll). */
export async function publishRealtime(channel: string, payload: unknown) {
  const r = getRedis();
  if (!r) return false;
  try {
    await r.publish(channel, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

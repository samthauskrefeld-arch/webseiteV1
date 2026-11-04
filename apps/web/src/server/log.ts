/**
 * Structured, privacy-aware logging. Never pass passwords, tokens, message bodies or
 * full e-mail addresses. Known sensitive keys are redacted defensively.
 */
const SENSITIVE = /pass|token|secret|authorization|cookie|body|content|email|iban/i;

function redact(v: unknown, depth = 0): unknown {
  if (depth > 3 || v === null || typeof v !== "object") return v;
  if (v instanceof Error) return { name: v.name, message: v.message, stack: process.env.NODE_ENV === "production" ? undefined : v.stack };
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(val, depth + 1)]));
}

export function logInfo(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", event, ts: new Date().toISOString(), ...(redact(data) as object) }));
}

export function logError(event: string, err: unknown, data: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ level: "error", event, ts: new Date().toISOString(), err: redact(err), ...(redact(data) as object) }));
}

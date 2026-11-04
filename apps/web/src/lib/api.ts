"use client";
/** Browser API client: adds CSRF header, JSON handling and typed errors. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const method = init.method ?? (init.body !== undefined || init.form ? "POST" : "GET");
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (method !== "GET") headers["x-mmj-csrf"] = "1";
  if (init.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path.startsWith("/api") ? path : `/api/v1${path}`, {
      method,
      headers,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      credentials: "same-origin",
      signal: init.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "OFFLINE", "Keine Verbindung. Bitte prüfe deine Internetverbindung.");
  }
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiClientError(res.status, err.code ?? "ERROR", err.message ?? "Unerwarteter Fehler", err.fields);
  }
  return data as T;
}

export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

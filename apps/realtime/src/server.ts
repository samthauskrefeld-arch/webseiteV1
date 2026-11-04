/**
 * Realtime chat delivery for My Minijob.
 * - Authenticates the WebSocket upgrade with the same httpOnly session cookie as the web app.
 * - Only participants of a conversation may subscribe (object-level authorisation).
 * - Messages are never sent through this channel – only "something changed" events; clients
 *   refetch over the authorised REST API. If this service is down, clients poll.
 */
import "dotenv/config";
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { getPrisma } from "@myminijob/db";
import Redis from "ioredis";
import { WebSocketServer, type WebSocket } from "ws";

const SESSION_COOKIE = "mmj_session";

export function hashToken(token: string, secret = process.env.SESSION_SECRET ?? "dev-only-insecure-session-secret-change-me!!") {
  return createHmac("sha256", secret).update(token).digest("hex");
}

function readCookie(req: IncomingMessage, name: string) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function authorize(req: IncomingMessage): Promise<{ userId: string; conversationId: string } | null> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const conversationId = url.searchParams.get("conversation") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null;
  const allowedOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
  if (allowedOrigin && req.headers.origin && req.headers.origin !== allowedOrigin) return null;
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const db = getPrisma();
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { status: true } } } });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const participant = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: session.userId } } });
  return participant ? { userId: session.userId, conversationId } : null;
}

export function startRealtime(port = Number(process.env.REALTIME_PORT ?? 3001)) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL ist für den Echtzeitdienst erforderlich");
  const sub = new Redis(redisUrl);
  const rooms = new Map<string, Set<WebSocket>>();
  sub.on("message", (channel, payload) => {
    const id = channel.slice("conversation:".length);
    for (const ws of rooms.get(id) ?? []) ws.send(payload);
  });

  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ok", rooms: rooms.size }));
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  server.on("upgrade", async (req, socket, head) => {
    try {
      const auth = await authorize(req);
      if (!auth) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        let set = rooms.get(auth.conversationId);
        if (!set) {
          set = new Set();
          rooms.set(auth.conversationId, set);
          sub.subscribe(`conversation:${auth.conversationId}`).catch(() => {});
        }
        set.add(ws);
        ws.send(JSON.stringify({ type: "ready" }));
        const alive = setInterval(() => ws.ping(), 30_000);
        ws.on("message", () => {
          /* clients do not send data over this channel */
        });
        ws.on("close", () => {
          clearInterval(alive);
          set!.delete(ws);
          if (!set!.size) {
            rooms.delete(auth.conversationId);
            sub.unsubscribe(`conversation:${auth.conversationId}`).catch(() => {});
          }
        });
      });
    } catch {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  });
  return new Promise<{ close: () => Promise<void>; port: number }>((resolve) => {
    server.listen(port, () => {
      const addr = server.address();
      resolve({
        port: typeof addr === "object" && addr ? addr.port : port,
        close: async () => {
          wss.clients.forEach((c) => c.terminate());
          await new Promise((r) => server.close(r));
          sub.disconnect();
        },
      });
    });
  });
}

const isMain = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");
if (isMain) {
  startRealtime().then(({ port }) => console.log(JSON.stringify({ level: "info", event: "realtime_started", port })));
}

import { randomBytes, randomUUID } from "node:crypto";
import { getPrisma } from "@myminijob/db";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { hashToken, startRealtime } from "./server";

const db = () => getPrisma();
let srv: Awaited<ReturnType<typeof startRealtime>>;
const pub = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

async function user(tag: string) {
  const u = await db().user.create({ data: { email: `${tag}-${randomUUID()}@rt.invalid`, passwordHash: "x", profile: { create: { username: `${tag}${randomBytes(4).toString("hex")}`, visibility: {} } } } });
  const token = randomBytes(32).toString("base64url");
  await db().session.create({ data: { userId: u.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
  return { u, token };
}

function connect(token: string | null, conversation: string) {
  return new Promise<{ ws: WebSocket; status: "open" | "rejected" }>((resolve) => {
    const ws = new WebSocket(`ws://localhost:${srv.port}/?conversation=${conversation}`, { headers: token ? { cookie: `mmj_session=${token}` } : {} });
    ws.once("message", () => resolve({ ws, status: "open" }));
    ws.once("unexpected-response", () => resolve({ ws, status: "rejected" }));
    ws.once("error", () => resolve({ ws, status: "rejected" }));
  });
}

describe("Realtime-Autorisierung", () => {
  let convId = "";
  let a: Awaited<ReturnType<typeof user>>;
  let stranger: Awaited<ReturnType<typeof user>>;
  beforeAll(async () => {
    srv = await startRealtime(0);
    a = await user("rta");
    const b = await user("rtb");
    stranger = await user("rtc");
    const listing = await db().listing.create({ data: { ownerId: b.u.id, posterType: "PRIVATE", title: "RT Test", description: "Realtime Test Inserat", category: "GARTEN", employmentType: "EINMALIG", positions: 1, hourlyWageCents: 1500, paymentMethod: "BANK_TRANSFER" } });
    const app = await db().application.create({ data: { listingId: listing.id, applicantId: a.u.id, resumeSnapshot: {}, idempotencyKey: randomUUID() } });
    const conv = await db().conversation.create({ data: { applicationId: app.id, participants: { create: [{ userId: a.u.id }, { userId: b.u.id }] } } });
    convId = conv.id;
  });
  afterAll(async () => {
    await srv.close();
    pub.disconnect();
    await db().$disconnect();
  });

  it("Teilnehmer erhalten Ereignisse", async () => {
    const { ws, status } = await connect(a.token, convId);
    expect(status).toBe("open");
    const got = new Promise<string>((r) => ws.once("message", (d) => r(d.toString())));
    await new Promise((r) => setTimeout(r, 100));
    await pub.publish(`conversation:${convId}`, JSON.stringify({ type: "message", id: "x" }));
    expect(JSON.parse(await got)).toMatchObject({ type: "message" });
    ws.close();
  });
  it("Dritte und Anonyme werden abgewiesen", async () => {
    expect((await connect(stranger.token, convId)).status).toBe("rejected");
    expect((await connect(null, convId)).status).toBe("rejected");
    expect((await connect(a.token, "nicht-uuid")).status).toBe("rejected");
  });
});

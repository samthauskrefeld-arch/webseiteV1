import { describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as registerRoute } from "@/app/api/v1/auth/register/route";
import { PATCH as roleRoute } from "@/app/api/v1/me/role/route";
import { GET as meRoute } from "@/app/api/v1/me/route";
import { hashToken } from "@/server/auth/crypto";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { login, requestPasswordReset, resetPassword, verifyEmail } from "@/server/services/auth";
import { ctx, makeUser, req } from "./helpers";

describe("Registrierung & Login", () => {
  it("registriert über die API, setzt ein httpOnly-Session-Cookie und speichert Einwilligungen", async () => {
    const email = `reg${Date.now()}@test.invalid`;
    const res = await registerRoute(req("POST", "/api/v1/auth/register", { body: { email, password: "Sicheres-Passwort-1", username: `reg${Date.now()}`, acceptTerms: true } }), ctx());
    expect(res.status).toBe(201);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/mmj_session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    const user = await db().user.findUniqueOrThrow({ where: { email }, include: { consents: true, roles: true } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.consents.map((c) => c.type).sort()).toEqual(["PRIVACY", "TERMS"]);
    expect(user.roles.map((r) => r.type).sort()).toEqual(["APPLICANT", "BUSINESS_POSTER", "PRIVATE_POSTER"]);
    const mail = await db().outboxEmail.findFirst({ where: { to: email }, orderBy: { createdAt: "desc" } });
    expect(mail?.subject).toContain("bestätige");
  });

  it("lehnt Registrierung ohne AGB-Zustimmung und mit schwachem Passwort ab", async () => {
    const res = await registerRoute(req("POST", "/api/v1/auth/register", { body: { email: "x@test.invalid", password: "kurz", username: "xyz", acceptTerms: false } }), ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(Object.keys(body.error.fields)).toEqual(expect.arrayContaining(["password", "acceptTerms"]));
  });

  it("verweigert mutierende Anfragen ohne CSRF-Header oder mit fremder Origin", async () => {
    const noHeader = await loginRoute(req("POST", "/api/v1/auth/login", { body: { email: "a@b.de", password: "x" }, csrf: false }), ctx());
    expect(noHeader.status).toBe(403);
    const foreign = await loginRoute(req("POST", "/api/v1/auth/login", { body: { email: "a@b.de", password: "x" }, origin: "https://evil.example" }), ctx());
    expect(foreign.status).toBe(403);
  });

  it("meldet mit korrekten Daten an und gibt für falsche Daten eine neutrale Fehlermeldung", async () => {
    const u = await makeUser();
    await expect(login(u.email, "falsch-falsch-1")).rejects.toThrow("E-Mail oder Passwort ist falsch.");
    await expect(login("gibtsnicht@test.invalid", "falsch-falsch-1")).rejects.toThrow("E-Mail oder Passwort ist falsch.");
    const ok = await login(u.email, u.password);
    expect(ok.session.token.length).toBeGreaterThan(30);
    const stored = await db().session.findFirst({ where: { userId: u.id, tokenHash: hashToken(ok.session.token) } });
    expect(stored).not.toBeNull();
    expect(await db().session.count({ where: { tokenHash: ok.session.token } })).toBe(0); // token never stored in clear text
  });

  it("verifiziert E-Mail mit Einmal-Token", async () => {
    const u = await makeUser({ verified: false });
    expect(u.emailVerified).toBe(false);
    const mail = await db().outboxEmail.findFirstOrThrow({ where: { to: u.email }, orderBy: { createdAt: "desc" } });
    const token = mail.text.match(/token=([\w-]+)/)![1]!;
    await verifyEmail(token);
    expect((await getSessionUser(u.token))!.emailVerified).toBe(true);
    await expect(verifyEmail(token)).rejects.toThrow(/ungültig/);
  });

  it("setzt Passwort zurück und beendet alle Sessions", async () => {
    const u = await makeUser();
    await requestPasswordReset(u.email);
    const mail = await db().outboxEmail.findFirstOrThrow({ where: { to: u.email, subject: "Passwort zurücksetzen" } });
    const token = mail.text.match(/token=([\w-]+)/)![1]!;
    await resetPassword(token, "Ganz-Neues-Passwort-2");
    expect(await getSessionUser(u.token)).toBeNull();
    await expect(login(u.email, u.password)).rejects.toThrow();
    await expect(login(u.email, "Ganz-Neues-Passwort-2")).resolves.toBeTruthy();
  });

  it("wechselt die aktive Rolle über die API", async () => {
    const u = await makeUser();
    const res = await roleRoute(req("PATCH", "/api/v1/me/role", { body: { role: "BUSINESS_POSTER" }, token: u.token }), ctx());
    expect(res.status).toBe(200);
    const me = await (await meRoute(req("GET", "/api/v1/me", { token: u.token }), ctx())).json();
    expect(me.user.activeRole).toBe("BUSINESS_POSTER");
    expect(me.user).not.toHaveProperty("sessionId");
    const bad = await roleRoute(req("PATCH", "/api/v1/me/role", { body: { role: "ADMIN" }, token: u.token }), ctx());
    expect(bad.status).toBe(422);
  });
});

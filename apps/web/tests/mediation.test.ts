import { FEE_NOTICE_VERSION } from "@myminijob/core";
import { describe, expect, it } from "vitest";
import { POST as acceptRoute } from "@/app/api/v1/applications/[id]/accept/route";
import { POST as applyRoute } from "@/app/api/v1/listings/[id]/applications/route";
import { db } from "@/server/db";
import { apply, getApplication, withdrawApplication } from "@/server/services/applications";
import { renderInvoicePdf, renderInvoiceXml } from "@/server/services/invoices";
import { changeListingStatus, createListing } from "@/server/services/listings";
import { acceptApplication, expireStaleOffers, markCompleted, openDispute, resolveDispute, respondToOffer, withdrawOffer } from "@/server/services/mediation";
import { payInvoice } from "@/server/services/payments";
import { createReview } from "@/server/services/community";
import { ctx, key, listingInput, makeAdmin, makeUser, req } from "./helpers";

const ack = { feeAcknowledged: true as const, feeNoticeVersion: FEE_NOTICE_VERSION };

async function publishedListing(positions = 1) {
  const owner = await makeUser({ prefix: "pst" });
  const { listing } = await createListing(owner, listingInput({ positions }));
  await changeListingStatus(owner, listing.id, "publish");
  return { owner, listing };
}

describe("Bewerbung – genau einmal", () => {
  it("derselbe Idempotency-Key liefert dieselbe Bewerbung (Doppelklick/Regler-Retry)", async () => {
    const { listing } = await publishedListing();
    const a = await makeUser({ prefix: "app" });
    const k = key();
    const [r1, r2] = await Promise.all([apply(a, listing.id, { message: "", documentFileIds: [] }, k), apply(a, listing.id, { message: "", documentFileIds: [] }, k)]);
    expect(r1.application.id).toBe(r2.application.id);
    expect(await db().application.count({ where: { listingId: listing.id } })).toBe(1);
    expect(await db().conversation.count({ where: { application: { listingId: listing.id } } })).toBe(1);
  });

  it("zweite Bewerbung mit neuem Key wird abgewiesen (409) und API antwortet beim Replay mit 200", async () => {
    const { listing } = await publishedListing();
    const a = await makeUser({ prefix: "app" });
    const k = key();
    const first = await applyRoute(req("POST", `/api/v1/listings/${listing.id}/applications`, { token: a.token, body: {}, headers: { "idempotency-key": k } }), ctx({ id: listing.id }));
    expect(first.status).toBe(201);
    const replay = await applyRoute(req("POST", `/api/v1/listings/${listing.id}/applications`, { token: a.token, body: {}, headers: { "idempotency-key": k } }), ctx({ id: listing.id }));
    expect(replay.status).toBe(200);
    expect((await replay.json()).replayed).toBe(true);
    const dup = await applyRoute(req("POST", `/api/v1/listings/${listing.id}/applications`, { token: a.token, body: {}, headers: { "idempotency-key": key() } }), ctx({ id: listing.id }));
    expect(dup.status).toBe(409);
  });

  it("unbestätigte E-Mail, eigenes Inserat und Entwürfe sind gesperrt", async () => {
    const { owner, listing } = await publishedListing();
    const unverified = await makeUser({ verified: false });
    await expect(apply(unverified, listing.id, { message: "", documentFileIds: [] }, key())).rejects.toThrow(/E-Mail/);
    await expect(apply(owner, listing.id, { message: "", documentFileIds: [] }, key())).rejects.toThrow(/eigenes Inserat/);
    const { listing: draft } = await createListing(owner, listingInput());
    const a = await makeUser();
    await expect(apply(a, draft.id, { message: "", documentFileIds: [] }, key())).rejects.toThrow(/nicht gefunden/);
  });

  it("Status submitted → viewed beim Öffnen durch Inseratsteller; Zurückziehen möglich", async () => {
    const { owner, listing } = await publishedListing();
    const a = await makeUser();
    const { application } = await apply(a, listing.id, { message: "Hallo", documentFileIds: [] }, key());
    expect((await getApplication(owner, application.id)).status).toBe("viewed");
    await withdrawApplication(a, application.id);
    const events = await db().applicationEvent.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["submitted", "viewed", "withdrawn"]);
  });
});

describe("Vermittlungsgebühr – genau ein Gebührenereignis", () => {
  it("Annahme ohne bestätigten Gebührenhinweis wird abgelehnt", async () => {
    const { owner, listing } = await publishedListing();
    const a = await makeUser();
    const { application } = await apply(a, listing.id, { message: "", documentFileIds: [] }, key());
    const res = await acceptRoute(req("POST", `/api/v1/applications/${application.id}/accept`, { token: owner.token, body: { feeAcknowledged: false, feeNoticeVersion: FEE_NOTICE_VERSION }, headers: { "idempotency-key": key() } }), ctx({ id: application.id }));
    expect(res.status).toBe(422);
    await expect(acceptApplication(owner, application.id, { ...ack, feeNoticeVersion: "alt" }, key())).rejects.toThrow(/aktualisiert/);
    expect(await db().mediationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("End-to-End: Zusage → Annahme → genau 1 Rechnung über 1,00 €, Wiederholungen ändern nichts", async () => {
    const { owner, listing } = await publishedListing();
    const a = await makeUser();
    const { application } = await apply(a, listing.id, { message: "", documentFileIds: [] }, key());
    const k = key();
    const [o1, o2] = await Promise.all([acceptApplication(owner, application.id, ack, k), acceptApplication(owner, application.id, ack, k)]);
    expect(o1.mediation.id).toBe(o2.mediation.id);
    expect(o1.mediation.feeCents).toBe(100);
    // no fee before the applicant confirmed
    expect(await db().invoice.count({ where: { mediationEventId: o1.mediation.id } })).toBe(0);
    // concurrent confirmations
    const results = await Promise.allSettled([respondToOffer(a, o1.mediation.id, true), respondToOffer(a, o1.mediation.id, true), respondToOffer(a, o1.mediation.id, true)]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const invoices = await db().invoice.findMany({ where: { mediationEventId: o1.mediation.id } });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ grossCents: 100, netCents: 84, taxCents: 16, kind: "INVOICE", recipientUserId: owner.id, isTest: true, status: "OPEN" });
    expect(invoices[0]!.number).toMatch(/^MMJ-\d{4}-\d{6}$/);
    // pay twice with same key → one payment; different key → rejected because already paid
    const pk = key();
    const [p1, p2] = await Promise.all([payInvoice(owner, invoices[0]!.id, pk), payInvoice(owner, invoices[0]!.id, pk)].map((p) => p.catch((e) => e)));
    const payments = await db().payment.findMany({ where: { invoiceId: invoices[0]!.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amountCents: 100, status: "SUCCEEDED", isTest: true });
    void p1;
    void p2;
    await expect(payInvoice(owner, invoices[0]!.id, key())).rejects.toThrow(/bereits bezahlt/);
    // second accept with new key is a conflict
    await expect(acceptApplication(owner, application.id, ack, key())).rejects.toThrow(/bereits eine Zusage/);
    // DB trigger protects fee & invoice amounts
    await expect(db().mediationEvent.update({ where: { id: o1.mediation.id }, data: { feeCents: 0 } })).rejects.toThrow();
    await expect(db().invoice.update({ where: { id: invoices[0]!.id }, data: { grossCents: 0, netCents: 0, taxCents: 0 } })).rejects.toThrow();
  });

  it("Plätze sind begrenzt – parallele Zusagen überbuchen nicht", async () => {
    const { owner, listing } = await publishedListing(2);
    const apps = [];
    for (let i = 0; i < 4; i++) {
      const a = await makeUser();
      apps.push((await apply(a, listing.id, { message: "", documentFileIds: [] }, key())).application);
    }
    const results = await Promise.allSettled(apps.map((ap) => acceptApplication(owner, ap.id, ack, key())));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await db().mediationEvent.count({ where: { listingId: listing.id } })).toBe(2);
  });

  it("Ablehnung, Rücknahme und Ablauf verursachen keine Gebühr und geben den Platz frei", async () => {
    const { owner, listing } = await publishedListing(1);
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    const appA = (await apply(a, listing.id, { message: "", documentFileIds: [] }, key())).application;
    const appB = (await apply(b, listing.id, { message: "", documentFileIds: [] }, key())).application;
    const appC = (await apply(c, listing.id, { message: "", documentFileIds: [] }, key())).application;
    const mA = (await acceptApplication(owner, appA.id, ack, key())).mediation;
    await expect(acceptApplication(owner, appB.id, ack, key())).rejects.toThrow(/Plätze/);
    await respondToOffer(a, mA.id, false); // declined → slot free
    const mB = (await acceptApplication(owner, appB.id, ack, key())).mediation;
    await withdrawOffer(owner, mB.id); // withdrawn → slot free
    const mC = (await acceptApplication(owner, appC.id, ack, key())).mediation;
    await db().mediationEvent.update({ where: { id: mC.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expireStaleOffers();
    await expect(respondToOffer(c, mC.id, true)).rejects.toThrow(/nicht mehr offen/);
    const statuses = (await db().mediationEvent.findMany({ where: { listingId: listing.id }, orderBy: { createdAt: "asc" } })).map((m) => m.status);
    expect(statuses).toEqual(["DECLINED", "WITHDRAWN_BY_POSTER", "EXPIRED"]);
    expect(await db().invoice.count({ where: { mediationEvent: { listingId: listing.id } } })).toBe(0);
  });

  it("nur der Inseratsteller darf zusagen, nur die Person darf annehmen", async () => {
    const { owner, listing } = await publishedListing();
    const a = await makeUser();
    const stranger = await makeUser();
    const { application } = await apply(a, listing.id, { message: "", documentFileIds: [] }, key());
    await expect(acceptApplication(stranger, application.id, ack, key())).rejects.toThrow(/Berechtigung/);
    const { mediation } = await acceptApplication(owner, application.id, ack, key());
    await expect(respondToOffer(owner, mediation.id, true)).rejects.toThrow(/nicht gefunden/);
    await expect(respondToOffer(stranger, mediation.id, true)).rejects.toThrow(/nicht gefunden/);
  });

  it("Storno über Streitfall: Stornorechnung mit negativem Betrag, Zahlung erstattet", async () => {
    const { owner, listing } = await publishedListing();
    const a = await makeUser();
    const admin = await makeAdmin();
    const { application } = await apply(a, listing.id, { message: "", documentFileIds: [] }, key());
    const { mediation } = await acceptApplication(owner, application.id, ack, key());
    await respondToOffer(a, mediation.id, true);
    const inv = await db().invoice.findFirstOrThrow({ where: { mediationEventId: mediation.id } });
    await payInvoice(owner, inv.id, key());
    const d = await openDispute(owner, mediation.id, "Person ist nicht erschienen (No-Show).");
    await resolveDispute(admin, d.id, true, "No-Show glaubhaft, Gebühr wird erstattet");
    const all = await db().invoice.findMany({ where: { mediationEventId: mediation.id }, orderBy: { createdAt: "asc" } });
    expect(all.map((i) => [i.kind, i.grossCents, i.status])).toEqual([
      ["INVOICE", 100, "REFUNDED"],
      ["CANCELLATION", -100, "PAID"],
    ]);
    expect(all[1]!.correctsInvoiceId).toBe(all[0]!.id);
    const pays = await db().payment.findMany({ where: { invoiceId: inv.id }, orderBy: { createdAt: "asc" } });
    expect(pays.map((p) => [p.status, p.amountCents])).toEqual([
      ["REFUNDED", 100],
      ["SUCCEEDED", -100],
    ]);
    expect((await db().mediationEvent.findUniqueOrThrow({ where: { id: mediation.id } })).status).toBe("CANCELLED");
  });

  it("Rechnung als PDF und E-Rechnung (XML) nur für den Empfänger", async () => {
    const { owner, listing } = await publishedListing();
    const a = await makeUser();
    const { application } = await apply(a, listing.id, { message: "", documentFileIds: [] }, key());
    const { mediation } = await acceptApplication(owner, application.id, ack, key());
    await respondToOffer(a, mediation.id, true);
    const inv = await db().invoice.findFirstOrThrow({ where: { mediationEventId: mediation.id } });
    const { pdf } = await renderInvoicePdf(owner, inv.id);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    const { xml } = await renderInvoiceXml(owner, inv.id);
    expect(xml).toContain(`<cbc:ID>${inv.number}</cbc:ID>`);
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">1.00</cbc:TaxInclusiveAmount>');
    await expect(renderInvoicePdf(a, inv.id)).rejects.toThrow(/Berechtigung/);
  });

  it("Bewertungen erst nach beidseitigem Abschluss, je Seite einmal", async () => {
    const { owner, listing } = await publishedListing();
    const a = await makeUser();
    const { application } = await apply(a, listing.id, { message: "", documentFileIds: [] }, key());
    const { mediation } = await acceptApplication(owner, application.id, ack, key());
    await respondToOffer(a, mediation.id, true);
    await expect(createReview(owner, mediation.id, 5, "Top")).rejects.toThrow(/Abschluss/);
    await markCompleted(owner, mediation.id);
    await expect(createReview(owner, mediation.id, 5, "Top")).rejects.toThrow(/Abschluss/);
    await markCompleted(a, mediation.id);
    const r = await createReview(owner, mediation.id, 5, "Sehr zuverlässig!");
    expect(r.moderated).toBe(false);
    await expect(createReview(owner, mediation.id, 4, "nochmal")).rejects.toThrow(/bereits bewertet/);
    const spam = await createReview(a, mediation.id, 5, "Besucht https://spam.example");
    expect(spam.moderated).toBe(true);
  });
});

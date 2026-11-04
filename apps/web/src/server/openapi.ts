import { z, type ZodType } from "zod";
import * as S from "@myminijob/core";

type Method = "get" | "post" | "put" | "patch" | "delete";
interface Op {
  method: Method;
  path: string;
  summary: string;
  tag: string;
  auth?: boolean;
  body?: ZodType;
  idempotent?: boolean;
}

const ops: Op[] = [
  { method: "post", path: "/auth/register", summary: "Konto registrieren (setzt Session-Cookie)", tag: "Auth", body: S.registerSchema },
  { method: "post", path: "/auth/login", summary: "Anmelden", tag: "Auth", body: S.loginSchema },
  { method: "post", path: "/auth/logout", summary: "Abmelden", tag: "Auth" },
  { method: "post", path: "/auth/verify-email", summary: "E-Mail bestätigen", tag: "Auth", body: S.tokenSchema },
  { method: "post", path: "/auth/resend-verification", summary: "Bestätigungsmail erneut senden", tag: "Auth", auth: true },
  { method: "post", path: "/auth/password-reset/request", summary: "Passwort-Reset anfordern", tag: "Auth", body: S.requestResetSchema },
  { method: "post", path: "/auth/password-reset/confirm", summary: "Neues Passwort setzen", tag: "Auth", body: S.resetPasswordSchema },
  { method: "get", path: "/me", summary: "Aktuelle Person", tag: "Konto" },
  { method: "delete", path: "/me", summary: "Konto löschen (DSGVO Art. 17)", tag: "Konto", auth: true, body: S.deleteAccountSchema },
  { method: "patch", path: "/me/role", summary: "Aktive Rolle wechseln", tag: "Konto", auth: true, body: S.changeRoleSchema },
  { method: "get", path: "/me/profile", summary: "Eigenes Profil und Lebenslauf", tag: "Profil", auth: true },
  { method: "put", path: "/me/profile", summary: "Profil speichern", tag: "Profil", auth: true, body: S.profileSchema },
  { method: "put", path: "/me/resume", summary: "Lebenslauf speichern", tag: "Profil", auth: true, body: S.resumeSchema },
  { method: "post", path: "/me/resume/qualifications", summary: "Qualifikation aus Katalog hinzufügen (Selbstangabe)", tag: "Profil", auth: true, body: S.resumeQualificationSchema },
  { method: "delete", path: "/me/resume/qualifications/{id}", summary: "Qualifikation entfernen", tag: "Profil", auth: true },
  { method: "get", path: "/me/export", summary: "Datenexport (DSGVO Art. 15/20)", tag: "Konto", auth: true },
  { method: "get", path: "/qualifications", summary: "Katalog-Autocomplete (?q=&kinds=)", tag: "Katalog" },
  { method: "get", path: "/qualifications/{id}", summary: "Qualifikation mit Aliasen", tag: "Katalog" },
  { method: "get", path: "/places", summary: "Orts-Autocomplete (?q=)", tag: "Katalog" },
  { method: "get", path: "/search", summary: "Suche (?q= natürliche Sprache | ?filters= JSON SearchQuery)", tag: "Suche" },
  { method: "post", path: "/search/parse", summary: "Natürliche Sprache → SearchQuery", tag: "Suche", body: z.object({ q: z.string() }) },
  { method: "get", path: "/listings", summary: "Neueste veröffentlichte Inserate", tag: "Inserate" },
  { method: "post", path: "/listings", summary: "Inserat anlegen (Entwurf)", tag: "Inserate", auth: true, body: S.listingInputSchema },
  { method: "get", path: "/listings/{id}", summary: "Inserat", tag: "Inserate" },
  { method: "put", path: "/listings/{id}", summary: "Inserat bearbeiten", tag: "Inserate", auth: true, body: S.listingInputSchema },
  { method: "post", path: "/listings/{id}/status", summary: "Veröffentlichen/Pausieren/Fortsetzen/Schließen/Archivieren", tag: "Inserate", auth: true, body: S.listingActionSchema },
  { method: "get", path: "/me/listings", summary: "Eigene Inserate", tag: "Inserate", auth: true },
  { method: "post", path: "/listings/{id}/applications", summary: "Bewerben (genau einmal)", tag: "Bewerbungen", auth: true, body: S.applySchema, idempotent: true },
  { method: "get", path: "/listings/{id}/applications", summary: "Bewerbungen zum eigenen Inserat", tag: "Bewerbungen", auth: true },
  { method: "get", path: "/me/applications", summary: "Eigene Bewerbungen", tag: "Bewerbungen", auth: true },
  { method: "get", path: "/applications/{id}", summary: "Bewerbung (Bewerber oder Inseratsteller)", tag: "Bewerbungen", auth: true },
  { method: "post", path: "/applications/{id}/withdraw", summary: "Bewerbung zurückziehen", tag: "Bewerbungen", auth: true },
  { method: "post", path: "/applications/{id}/shortlist", summary: "Engere Wahl", tag: "Bewerbungen", auth: true },
  { method: "post", path: "/applications/{id}/reject", summary: "Absagen", tag: "Bewerbungen", auth: true, body: S.applicationNoteSchema },
  { method: "post", path: "/applications/{id}/accept", summary: "Zahlungspflichtig zusagen (Gebührenhinweis bestätigt)", tag: "Vermittlung", auth: true, body: S.acceptApplicationSchema, idempotent: true },
  { method: "get", path: "/me/offers", summary: "Erhaltene Zusagen", tag: "Vermittlung", auth: true },
  { method: "post", path: "/mediations/{id}/respond", summary: "Zusage annehmen/ablehnen (Annahme = Gebührenereignis)", tag: "Vermittlung", auth: true, body: z.object({ accept: z.boolean() }) },
  { method: "post", path: "/mediations/{id}/withdraw", summary: "Offene Zusage zurücknehmen (keine Gebühr)", tag: "Vermittlung", auth: true },
  { method: "post", path: "/mediations/{id}/complete", summary: "Auftrag als erledigt markieren", tag: "Vermittlung", auth: true },
  { method: "post", path: "/mediations/{id}/dispute", summary: "Storno/Streitfall eröffnen", tag: "Vermittlung", auth: true, body: S.disputeSchema },
  { method: "post", path: "/mediations/{id}/reviews", summary: "Bewertung abgeben (nach Abschluss)", tag: "Bewertungen", auth: true, body: S.reviewSchema },
  { method: "get", path: "/me/invoices", summary: "Eigene Rechnungen", tag: "Rechnungen", auth: true },
  { method: "get", path: "/invoices/{id}", summary: "Rechnung", tag: "Rechnungen", auth: true },
  { method: "get", path: "/invoices/{id}/pdf", summary: "Rechnung als PDF", tag: "Rechnungen", auth: true },
  { method: "get", path: "/invoices/{id}/xml", summary: "E-Rechnung (UBL/XRechnung-Entwurf)", tag: "Rechnungen", auth: true },
  { method: "post", path: "/invoices/{id}/pay", summary: "Rechnung bezahlen (nur Testadapter)", tag: "Rechnungen", auth: true, idempotent: true },
  { method: "get", path: "/me/billing-address", summary: "Rechnungsadresse", tag: "Rechnungen", auth: true },
  { method: "put", path: "/me/billing-address", summary: "Rechnungsadresse speichern", tag: "Rechnungen", auth: true, body: S.billingAddressSchema },
  { method: "post", path: "/files", summary: "Datei hochladen (multipart: file, purpose)", tag: "Dateien", auth: true },
  { method: "get", path: "/me/files", summary: "Eigene Dateien", tag: "Dateien", auth: true },
  { method: "get", path: "/files/{id}", summary: "Autorisierter Download", tag: "Dateien", auth: true },
  { method: "delete", path: "/files/{id}", summary: "Datei löschen", tag: "Dateien", auth: true },
  { method: "get", path: "/me/conversations", summary: "Unterhaltungen", tag: "Chat", auth: true },
  { method: "get", path: "/conversations/{id}/messages", summary: "Nachrichten (?after=)", tag: "Chat", auth: true },
  { method: "post", path: "/conversations/{id}/messages", summary: "Nachricht senden (Idempotency-Key = clientId)", tag: "Chat", auth: true, body: S.messageSchema },
  { method: "post", path: "/conversations/{id}/read", summary: "Als gelesen markieren", tag: "Chat", auth: true },
  { method: "patch", path: "/conversations/{id}", summary: "Lesebestätigungen ein/aus", tag: "Chat", auth: true, body: z.object({ shareReadReceipts: z.boolean() }) },
  { method: "post", path: "/users/{id}/block", summary: "Person blockieren", tag: "Chat", auth: true },
  { method: "delete", path: "/users/{id}/block", summary: "Blockierung aufheben", tag: "Chat", auth: true },
  { method: "get", path: "/profiles/{username}", summary: "Öffentliches Profil", tag: "Profil" },
  { method: "get", path: "/me/notifications", summary: "Benachrichtigungen", tag: "Benachrichtigungen", auth: true },
  { method: "post", path: "/me/notifications", summary: "Als gelesen markieren", tag: "Benachrichtigungen", auth: true },
  { method: "get", path: "/me/notification-preferences", summary: "Präferenzen", tag: "Benachrichtigungen", auth: true },
  { method: "put", path: "/me/notification-preferences", summary: "Präferenzen speichern", tag: "Benachrichtigungen", auth: true, body: S.notificationPrefsSchema },
  { method: "post", path: "/reports", summary: "Inhalt melden", tag: "Moderation", auth: true, body: S.reportSchema },
  { method: "get", path: "/me/business", summary: "Unternehmensprofil", tag: "Unternehmen", auth: true },
  { method: "put", path: "/me/business", summary: "Unternehmensprofil speichern", tag: "Unternehmen", auth: true, body: S.businessSchema },
  { method: "post", path: "/me/business/verification", summary: "Verifizierung beantragen", tag: "Unternehmen", auth: true },
  { method: "post", path: "/ai/chat", summary: "My Minijob AI (nur lesende Tools)", tag: "KI", body: S.aiChatSchema },
  { method: "get", path: "/admin/overview", summary: "Moderations-Übersicht", tag: "Admin", auth: true },
];

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of ops) {
    const params = [...op.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
    if (op.idempotent) params.push({ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } });
    if (op.method !== "get") params.push({ name: "x-mmj-csrf", in: "header", required: true, schema: { type: "string" } });
    paths[op.path] ??= {};
    paths[op.path]![op.method] = {
      summary: op.summary,
      tags: [op.tag],
      ...(op.auth ? { security: [{ session: [] }] } : {}),
      parameters: params,
      ...(op.body ? { requestBody: { required: true, content: { "application/json": { schema: z.toJSONSchema(op.body, { io: "input", unrepresentable: "any" }) } } } } : {}),
      responses: {
        "200": { description: "OK" },
        "4XX": { description: "Fehler", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "My Minijob API", version: "1.0.0", description: "Versionierte REST-API. Mutierende Anfragen benötigen den Header x-mmj-csrf: 1." },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: { session: { type: "apiKey", in: "cookie", name: "mmj_session" } },
      schemas: {
        Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, fields: { type: "object", additionalProperties: { type: "string" } } } } } },
        SearchQuery: z.toJSONSchema(S.searchQuerySchema),
      },
    },
    paths,
  };
}

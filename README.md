# My Minijob

Plattform für flexible Tätigkeiten in Deutschland: Bewerber finden Jobs (Garten, Haushalt, Nachhilfe, Events, Büro, Handwerk, Teil-/Vollzeit, Ausbildung …), private und gewerbliche Auftraggeber inserieren kostenlos. Erst bei bestätigter Vermittlung zahlt der Inseratsteller **1,00 € pro vermittelter Person**. Löhne laufen nie über die Plattform.

> **Status:** funktionsfähige Entwicklungsversion. Zahlungen laufen ausschließlich über einen klar gekennzeichneten **Testadapter**. Rechtstexte sind **Entwürfe**. Vor dem Livebetrieb: [docs/LEGAL-REVIEW.md](docs/LEGAL-REVIEW.md) und [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md).

## Schnellstart (lokal)

Voraussetzungen: Node.js ≥ 22.12, pnpm 10, Docker (oder lokal PostgreSQL 16 + Redis 7).

```bash
docker compose up -d                 # Postgres, Redis, MinIO (S3), Mailpit
cp .env.example .env && cp .env packages/db/.env && cp .env apps/web/.env && cp .env apps/realtime/.env
pnpm install                         # generiert auch den Prisma-Client
pnpm db:migrate                      # SQL-Migrationen anwenden
SEED_DEMO=1 pnpm db:seed             # Orte, Qualifikationskatalog, Demo-Konten/-Inserate
pnpm dev                             # Web: http://localhost:3000 · Realtime: ws://localhost:3001
```

Demo-Konten (nur mit `SEED_DEMO=1`, Passwort `Demo-Passwort-2026`): `anna@myminijob.local` (Bewerberin), `garten@myminijob.local` (Privat), `firma@myminijob.local` (Gewerblich), `admin@myminijob.local` (Administration). Demo-Inserate tragen sichtbar das Abzeichen „Demo“.

E-Mails: Mailpit unter http://localhost:8025 (mit `SMTP_HOST=localhost`, `SMTP_PORT=1025`) – ohne SMTP landen sie im Dev-Postfach http://localhost:3000/dev/mails.

### Befehle

| Befehl | Zweck |
|---|---|
| `pnpm typecheck` | TypeScript in allen Paketen (inkl. Next-Routentypen) |
| `pnpm test` | Unit- und Integrationstests (Vitest, echte PostgreSQL-Testdatenbank) |
| `pnpm build` | Produktionsbuild |
| `pnpm test:e2e` | Playwright-E2E gegen den Produktionsbuild (eigene DB `myminijob_e2e`) |
| `pnpm --filter @myminijob/db check-drift` | Prüft, dass Migrationen exakt `schema.prisma` entsprechen |
| `pnpm --filter @myminijob/db import-catalog -- --file … --version … --source … --license …` | Versionierter Katalogimport |
| `pnpm --filter @myminijob/web maintenance` | Abgelaufene Zusagen/Sessions/Tokens bereinigen (z. B. alle 15 min per Cron) |
| `pnpm --filter @myminijob/web openapi` | `docs/openapi.json` erzeugen (live: `/api/v1/openapi.json`) |
| `./scripts/backup.sh`, `./scripts/restore.sh`, `./scripts/restore-test.sh` | Backup, Wiederherstellung, automatisierter Restore-Test |

## Architektur

Kurzfassung (Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- **Monorepo** (pnpm + Turborepo): `packages/core` (Domäne, Zod, Parser, Gebühren), `packages/db` (Prisma 7, SQL-Migrationen, Seeds, Importer), `apps/web` (Next.js 16: UI/PWA + REST-API `/api/v1`), `apps/realtime` (WebSocket-Zustellung via Redis).
- **Daten:** PostgreSQL 16 mit `pg_trgm` (Autocomplete, Tippfehler) und deutscher Volltextsuche; UUIDs, Fremdschlüssel, Indizes, Statushistorie, Geld in Integer-Cent, DB-Trigger gegen nachträgliche Änderung von Gebühren- und Rechnungsbeträgen, Audit-Log append-only.
- **Sicherheit:** Argon2id, Sessions als HMAC-gehashte Tokens in httpOnly/SameSite-Cookies, CSRF (Custom-Header + Origin-Prüfung), CSP mit Nonce, Security-Header, objektbezogene Autorisierung, Rate-Limits (Redis/In-Memory), Upload-Prüfung (Magic Bytes, aktive PDF-Inhalte, optional ClamAV), private Dateien nur über autorisierte Downloads.

## Implementierte Funktionen

- **App-Shell & PWA:** Design-Tokens hell/dunkel (System + manuell), schwebende Bottom-Navigation mit genau zwei Tabs („Discover“, „Mein Konto“) und gleitendem Indikator, Desktop-Sidebar, Safe Areas, Skip-Link, Fokuszustände, reduced motion, Manifest, Service Worker mit Offline-Seite, Web-Push vorbereitet. Überspringbares Intro nur beim ersten Besuch.
- **Auth & Konto:** Registrierung (AGB/Datenschutz-Einwilligung protokolliert), E-Mail-Bestätigung, Login, Passwort-Reset (beendet alle Sessions), Rollenwechsel Bewerber/Privat/Gewerblich, Benachrichtigungen (In-App/E-Mail/Push) mit Präferenzen, Datenexport, Kontolöschung (Anonymisierung, Rechnungen bleiben).
- **Qualifikationskatalog:** 174 Einträge (Ausbildungsberufe, Studienfächer, Meister/Fortbildung, Zertifikate, Berufsbezeichnungen) + 156 Aliase, Autocomplete ab 2 Zeichen mit 150 ms Debounce (Präfix, Alias, Trigramm). Gemeinsame `qualification_id` für Profile und Inserate; Selbstangabe vs. geprüft (nur Admin mit Nachweis). Alias-Pflege und versionierte Importe.
- **Inserate:** animierter Wizard (Privat/Gewerblich → Tätigkeit → Ort & Zeit → Vergütung → Anforderungen „erforderlich/wünschenswert“ → Vorschau), Pflicht-Stundenlohn, Mindestlohn-Hinweis, keine Barzahlung, Missbrauchsfilter, Entwurf/Veröffentlichen/Pausieren/Schließen/Archivieren, Bearbeiten.
- **KI-Suche:** natürliche Sprache → strukturierte Filter (Tätigkeit, Ort, Radius, Mindestlohn, Wochenende/Abends, Beschäftigungsart, Qualifikation). Regelparser immer aktiv; mit `ANTHROPIC_API_KEY` zusätzlich LLM mit JSON-Schema, Zod-Validierung und Plausibilitätsprüfung gegen den Eingabetext. Nur echte, veröffentlichte Inserate; Entfernungen nur mit echten Koordinaten. Filterchips, „In meiner Nähe“ nur nach Einwilligung.
- **Lebenslauf & Bewerbung:** wiederverwendbarer Lebenslauf, Sichtbarkeit pro Feld, PDF-Dokumente, Vorschau/Druck. Bewerbung in 3 Schritten mit „Zum Bewerben schieben“ (sendet genau einmal per Idempotency-Key, Häkchen erst nach Serverbestätigung) und barrierefreiem Button.
- **Vermittlung & Gebühr:** Auftraggeber-Dashboard; „Zahlungspflichtig zusagen (1,00 €)“ mit Gebührenhinweis (versioniert gespeichert); Gebührenereignis erst wenn die Person annimmt; Ablehnung/Rücknahme/Ablauf ohne Gebühr; Plätze gegen Überbuchung gesperrt; Abschluss beidseitig; Storno über Streitfall mit Stornorechnung und Erstattung.
- **Rechnungen:** fortlaufende Nummern (`MMJ-JJJJ-000001`), PDF, E-Rechnung im UBL-/XRechnung-Format (Entwurf), Steuer-Modus konfigurierbar, Testzahlung.
- **Chat:** pro Bewerbung, Zustell-/Lesestatus (abschaltbar), Anhänge, Blockieren, Melden; Echtzeit per WebSocket mit Polling-Fallback.
- **My Minijob AI:** schwebendes Panel; serverseitige, nur lesende Tools `searchListings`, `getMyApplications`, `getHelpArticle`, `suggestResumeEdits`; Tageslimits, Prompt-Injection-Hinweise, Basismodus ohne KI klar gekennzeichnet.
- **Moderation & Vertrauen:** Bewertungen nur nach beidseitigem Abschluss, Link-Moderation, Meldungen mit begründeten Entscheidungen, Firmenverifizierung nur nach Admin-Prüfung eines Nachweises.

## Tests

Siehe [docs/TEST-REPORT.md](docs/TEST-REPORT.md) – alle Zahlen dort stammen aus tatsächlich ausgeführten Läufen.

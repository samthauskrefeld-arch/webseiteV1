# My Minijob – Architekturübersicht

## Überblick

```
┌─────────────────────────────── Clients ───────────────────────────────┐
│  Web/PWA (Next.js, apps/web)   │  später: Expo (iOS/Android), Tauri    │
│  React 19 · Tailwind 4 · Motion│  (Desktop) – nutzen dieselbe API v1   │
└───────────────┬────────────────┴──────────────────┬───────────────────┘
                │ HTTPS  /api/v1/* (JSON, OpenAPI)  │ WSS (Chat-Push)
┌───────────────▼──────────────────────┐  ┌─────────▼──────────────────┐
│ apps/web – Next.js Route Handlers    │  │ apps/realtime – ws-Server  │
│  src/server/*  Services (Auth, RBAC, │  │  Session-Auth, Redis-Sub,  │
│  Listings, Search, Applications,     │  │  nur Teilnehmer erhalten   │
│  Mediation/Fees, Invoices, Chat, AI) │  │  Konversations-Events      │
└──┬─────────┬─────────┬─────────┬─────┘  └─────────┬──────────────────┘
   │Prisma 7 │ Redis   │ S3      │ SMTP/Push/AI       │ Redis Pub/Sub
┌──▼───────┐ ┌▼──────┐ ┌▼──────┐ ┌▼──────────────┐    │
│PostgreSQL│ │Rate-  │ │privat │ │Adapter mit     │◄───┘
│16+pg_trgm│ │Limit, │ │Bucket │ │Testmodus       │
└──────────┘ │PubSub │ └───────┘ └────────────────┘
             └───────┘
```

## Monorepo (pnpm + Turborepo)

| Paket | Inhalt |
|---|---|
| `packages/core` | Framework-freie Domäne: Enums, Zustandsautomaten, Zod-Schemas, Geldlogik (Cent), Gebühren/Steuer, NL-Suchparser, Normalisierung, Hilfeartikel. Von Server **und** Client genutzt. |
| `packages/db` | Prisma-Schema, SQL-Migrationen (Prisma-kompatibel), Migrationsrunner, Drift-Check, Katalog-Importer, Seeds. |
| `apps/web` | Next.js 16 App Router: UI (PWA) und versionierte REST-API `/api/v1`. Geschäftslogik in `src/server/services/*`, Adapter in `src/server/adapters/*`. |
| `apps/realtime` | WebSocket-Server für Chat-Zustellung in Echtzeit (Redis-Pub/Sub). Fällt er aus, pollt der Client. |

## Wichtige Entscheidungen

* **Konsistente Next.js-Backendarchitektur** statt separatem NestJS-Dienst: ein Deployment, gemeinsame Typen. Route Handler sind dünn (`route()`-Wrapper: Auth, CSRF-Origin-Prüfung, Rate-Limit, Zod-Validierung, Fehler-Mapping); Logik liegt in Services, die ohne HTTP testbar sind.
* **Rollen:** ein Konto, mehrere Rollen (`Role`-Tabelle). `activeRole` steuert nur die Oberfläche; Berechtigungen werden **pro Objekt** geprüft (Eigentümer des Inserats, Teilnehmer der Konversation …).
* **Gebühr:** `Application.accepted` (verbindliche, gebührenbestätigte Zusage) ≠ `MediationEvent.CONFIRMED` (Person nimmt an → Vermittlung zustande → Gebührenereignis) ≠ `Invoice`. Genau ein `MediationEvent` pro Bewerbung (UNIQUE), Idempotenzschlüssel, `SELECT … FOR UPDATE` auf das Inserat gegen Überbuchung der Plätze, DB-Trigger machen Gebühren- und Rechnungsbeträge unveränderlich.
* **Suche:** Regelbasierter deutscher Parser (immer verfügbar) → optional LLM-Parser (JSON-Schema + Zod + Plausibilitätsprüfung gegen den Eingabetext) → strukturierte SQL-Suche (Volltext `german` + Trigramm + Filter). Nur echte, veröffentlichte Datensätze. Entfernungen nur, wenn beide Seiten Koordinaten haben, als „ca. … km (Ortsmitte)“.
* **Katalog:** eine `Qualification`-ID für Profile und Inserate; Aliase separat; versionierte Importe (`CatalogImport` mit Checksumme), Einträge werden deaktiviert statt gelöscht.
* **Geld:** Integer-Cent überall; Steuer-Modus konfigurierbar.
* **Migrationen:** SQL-Dateien im Prisma-Layout, angewendet von `scripts/migrate.ts` mit Prisma-kompatibler `_prisma_migrations`-Buchführung. Der Drift-Check vergleicht Schema und Migrationen in CI.

## Externe Integrationen und Testmodi

| Integration | Produktiv | Ohne Konfiguration |
|---|---|---|
| E-Mail | SMTP (nodemailer) | Speicherung in `OutboxEmail`, Dev-Postfach `/dev/mails` (nur `NODE_ENV≠production`) |
| Objektspeicher | S3-kompatibel (privat, Zugriff nur über autorisierte API) | lokaler privater Ordner `.storage` |
| Virenscan | ClamAV (clamd INSTREAM) | Status `NOT_SCANNED`, sichtbar markiert |
| KI | Anthropic Messages API mit Tools | Regelparser + Basismodus-Assistent (Hilfeartikel, Suche), klar gekennzeichnet |
| Zahlung | **nicht implementiert** – Vertrag/Rechtsprüfung nötig | Testadapter „TESTZAHLUNG“, `isTest=true` auf Rechnung und Zahlung |
| Push | Web-Push (VAPID) | deaktiviert, In-App + E-Mail funktionieren |
| Echtzeit | Redis + apps/realtime | Polling alle 5 s |

## Native Clients (vorbereitet, nicht umgesetzt)

Die API ist zustandslos bis auf das Session-Cookie; für Expo/Tauri ist ein Bearer-Token-Login (`POST /api/v1/auth/login` mit `"client":"native"`) vorgesehen und dokumentiert in `docs/OPEN-ITEMS.md`. Gemeinsame Typen/Validierung kommen aus `@myminijob/core`.

# Offene Punkte

## Bewusst nicht live geschaltet (Adapter + Testmodus vorhanden)

- **Zahlungsanbieter:** Nur `PAYMENT_PROVIDER=test`. Rechnungen und Zahlungen tragen `isTest=true`, die UI zeigt „Testmodus“. Live-Anbindung (z. B. SEPA-Lastschrift über einen PSP) erst nach Vertrag und Rechtsprüfung; Schnittstelle: `PaymentProvider` in `apps/web/src/server/services/payments.ts`.
- **KI:** Ohne `ANTHROPIC_API_KEY` Regelparser und Basismodus. Mit Schlüssel aktiv, aber in dieser Umgebung ungetestet. Vor Aktivierung: AV-Vertrag, Datenschutzhinweis, Kostenbudget (`aiDailyRequests*` in `LIMITS`).
- **Virenscan:** ClamAV-Adapter vorhanden; ohne `CLAMAV_HOST` werden Dateien als „nicht virengeprüft“ markiert. In Produktion Pflicht machen.
- **Web-Push:** VAPID-Schlüssel erzeugen (`npx web-push generate-vapid-keys`).

## Abweichungen von der Vorgabe

- **Prisma-Migrationen:** In der Entwicklungsumgebung war `binaries.prisma.sh` gesperrt, die native Schema-Engine nicht ladbar. Migrationen sind daher SQL-Dateien im Prisma-Layout, angewendet von `packages/db/scripts/migrate.ts` (Prisma-kompatible `_prisma_migrations`-Tabelle); `check-drift` sichert die Übereinstimmung mit `schema.prisma`. Mit vollem Internetzugang kann `prisma migrate dev` für künftige Migrationen genutzt werden.
- **shadcn/ui:** Die Komponenten sind im shadcn-Stil selbst geschrieben (Radix Dialog/Slot, cva, tailwind-merge), nicht per shadcn-CLI erzeugt.
- **Next.js-Backend** statt NestJS (laut Vorgabe zulässig). Echtzeit als separater WebSocket-Dienst.
- **Native Apps:** nicht umgesetzt. Vorbereitet durch versionierte API, OpenAPI und framework-freies `@myminijob/core`. Für Expo/Tauri fehlt noch ein Token-Login (Bearer statt Cookie) und Push über APNs/FCM.

## Vor dem Livebetrieb

1. Rechtsprüfung gemäß [LEGAL-REVIEW.md](LEGAL-REVIEW.md); Rechtstexte, Impressum und `OPERATOR_*`-Angaben ersetzen.
2. Lizenzierte Katalog- und Ortsdaten importieren ([DATA-SOURCES.md](DATA-SOURCES.md)).
3. Infrastruktur: TLS, verwaltetes PostgreSQL mit PITR-Backups, Redis, S3 mit Verschlüsselung und Lifecycle, SMTP mit SPF/DKIM/DMARC, ClamAV, Monitoring/Alerting, Log-Aufbewahrung. Reverse-Proxy leitet `/realtime` an `apps/realtime` (gleiche Domain, damit das Session-Cookie gilt) und setzt `X-Forwarded-For` vertrauenswürdig.
4. Cron für `pnpm --filter @myminijob/web maintenance` (z. B. alle 15 min) und regelmäßigen `restore-test.sh`.
5. Penetrationstest, Lasttest, manuelle Screenreader-Tests (VoiceOver, TalkBack, NVDA), Tests auf Safari/Firefox und echten Geräten.
6. Rechnungsprozess: ggf. Sammelrechnung pro Monat statt Einzelrechnung à 1,00 €; XRechnung mit KoSIT-Validator prüfen.
7. Admin-Konten mit Zwei-Faktor-Authentifizierung absichern (noch nicht implementiert).

## Bekannte Grenzen

- Registrierung mit bereits vorhandener E-Mail meldet „nicht möglich“ (geringes Enumerationsrisiko, rate-limitiert); Inhaber wird per Mail informiert.
- Missbrauchsfilter für Inserate ist ein einfacher Musterfilter; Melden + Moderation ergänzen ihn.
- Rate-Limits ohne Redis gelten nur pro Instanz.
- Die Lebenslauf-„PDF“ entsteht über die Druckfunktion des Browsers.

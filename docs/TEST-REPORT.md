# Testbericht

Stand: 04.11.2026, ausgeführt in der Entwicklungsumgebung (Linux, Node 22.23, PostgreSQL 16.15, Redis 7.0, Chromium headless 1243). Alle Ergebnisse unten stammen aus echten Läufen; nichts ist geschätzt.

## Ergebnisse

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Typecheck (4 Pakete) | `pnpm typecheck` | ✅ 0 Fehler |
| Unit-Tests `packages/core` | `pnpm test` | ✅ 21/21 |
| Integrationstests `apps/web` (echte Test-DB) | `pnpm test` | ✅ 39/39 |
| Realtime-Autorisierung `apps/realtime` | `pnpm test` | ✅ 2/2 |
| Schema-Drift (schema.prisma ↔ Migrationen) | `check-drift` | ✅ 324 Spalten, 97 Indizes identisch |
| Produktionsbuild | `pnpm build` | ✅ (auch `NEXT_OUTPUT=standalone`, Server gestartet, Health OK) |
| E2E Desktop + Mobile (Produktionsbuild) | `pnpm test:e2e` | ✅ 26/26 |
| Restore-Test | `./scripts/restore-test.sh` | ✅ Zeilenzahlen und Migrationsstand identisch |
| Security-Header | `curl -I` gegen Standalone-Server | ✅ CSP mit Nonce, HSTS, X-Frame-Options, Referrer-/Permissions-Policy |

## Abgedeckte Fälle

**Unit (core):** Normalisierung (Umlaute, Gender-Suffixe), Geldparser/-format (nur Integer-Cent), NL-Parser mit beiden Beispielanfragen aus der Spezifikation, „in Teilzeit“ ≠ Ort, PLZ, keine erfundenen Orte, Bereinigung halluzinierter KI-Werte, Brutto/Netto 1,00 € (84 + 16 Cent) und Kleinunternehmer, Rechnungsnummern, Zustandsautomaten (Inserat, Bewerbung inkl. Akteur), Inserats-Validierung (keine Barzahlung, Ort oder Remote), Registrierung ohne AGB, Mindestlohntabelle, Hilfeartikel.

**Integration (web, über Services und echte Route-Handler):**
- Registrierung über die API (httpOnly-/SameSite-Cookie, Argon2id, Einwilligungen, Bestätigungsmail), Validierungsfehler, CSRF ohne Header/fremde Origin → 403, Login mit neutraler Fehlermeldung, Token nie im Klartext gespeichert, E-Mail-Bestätigung (Einmal-Token), Passwort-Reset beendet Sessions, Rollenwechsel inkl. Ablehnung „ADMIN“.
- Katalog: „Ele“ → Elektroniker, „BWL“ → Betriebswirtschaftslehre (Alias), Mechatroniker ≠ Elektroniker, „Elektriker“ nur Alias, Tippfehler, Filter nach Art.
- Suche: Beispielanfrage findet nur veröffentlichte Inserate oberhalb des Mindestlohns, echte Entfernung 0 km, unbekannter Ort ohne erfundene Entfernungen, Radiusfilter.
- Bewerbung: parallele Doppelanfrage mit gleichem Key → genau 1 Bewerbung + 1 Unterhaltung; Replay 200, neue Bewerbung 409; unbestätigte E-Mail/eigenes Inserat/Entwurf gesperrt; Statushistorie submitted → viewed → withdrawn.
- Gebühr: ohne Gebührenbestätigung 422, veraltete Hinweisversion 409; parallele Zusagen mit gleichem Key → 1 Ereignis; keine Rechnung vor Annahme; drei parallele Annahmen → genau 1 Rechnung (100/84/16 Cent, Testmodus); doppelte Zahlung → 1 Zahlung; DB-Trigger blockieren Änderung von Gebühr und Rechnungsbetrag; 4 parallele Zusagen bei 2 Plätzen → genau 2; Ablehnung/Rücknahme/Ablauf → keine Rechnung; fremde Personen können weder zusagen noch annehmen; Storno → Stornorechnung −1,00 €, Erstattung; PDF und XML nur für Empfänger; Bewertungen erst nach beidseitigem Abschluss, je einmal, Link-Bewertung moderiert.
- Chat: nur Beteiligte (Service und HTTP 403), idempotente Nachrichten, keine E-Mail-Adressen in Antworten, Zustell-/Lesestatus inkl. Abschaltung, Blockieren, Meldung + Ausblenden.
- Dateien: Magic-Byte-Prüfung, PDF mit JavaScript abgelehnt, objektbezogener Download (Inseratsteller ja, Dritte nein), `attachment` + `nosniff`.
- Sichtbarkeit: „Nur ich“-Felder fehlen im Bewerbungs-Snapshot; Katalog-Qualifikationen sind Selbstangabe.
- KI-Tool-Sicherheit (Basismodus): nur echte veröffentlichte Inserate, Bewerbungen nur für den Eigentümer, Prompt-Injection erzeugt keine Bewerbung, Gebührenfrage aus Hilfeartikel.
- Datenschutz: Export, Löschung mit Passwort, Anonymisierung, Session-Ende, offene Bewerbungen zurückgezogen.

**Realtime:** Teilnehmer erhalten Ereignisse; Dritte, Anonyme und ungültige IDs werden beim Upgrade abgewiesen.

**E2E (Playwright, Produktionsbuild):**
1. Bewerber registriert sich über die UI und bestätigt die E-Mail über den Link aus dem Postausgang.
2. Hinterlegt per Autocomplete („Ele“ → „Elektroniker Ener…“) eine Qualifikation (als „Selbstangabe“ angezeigt) und speichert den Lebenslauf.
3. Sucht „Gartenarbeit ab 12,50 Euro Raum Krefeld“ (Chips Kategorie/Lohn/Ort+Radius), öffnet das Inserat und bewirbt sich per Maus-Drag am Schieberegler → „Bewerbung gesendet“; genau 1 Datensatz.
4. Auftraggeber sieht die Qualifikation, öffnet „Verbindlich zusagen“, Schaltfläche bleibt bis zur Bestätigung deaktiviert, „Zahlungspflichtig zusagen (1,00 €)“ → noch keine Rechnung.
5. Bewerber nimmt per **Doppelklick** an → genau 1 Rechnung (100 Cent, Test); Auftraggeber führt Testzahlung aus → genau 1 Zahlung; PDF-Download.
6. Chatnachricht erscheint bei beiden Parteien.
- WCAG 2.2 AA (axe) auf Start, Suche, Anmelden, Registrieren, Hilfe, Gebühren, Inseratsdetail – jeweils hell und dunkel: 0 Verstöße (ein Kontrastproblem der Status-Badges wurde dabei gefunden und behoben).
- Dark-Mode-Token, Skip-Link + sichtbarer Fokus per Tastatur, reduced motion verkürzt Übergänge, Intro überspringbar und gemerkt, KI-Assistent im Basismodus mit echten Inseratslinks.
- Mobil (Pixel 7): Bottom-Navigation mit genau 2 Tabs, Touchflächen ≥ 44 px, Safe-Area-Abstand, Chatblase oberhalb der Navigation.

## Während der Tests gefundene und behobene Fehler

- Gleichzeitige Zusage mit identischem Idempotency-Key lieferte 409 statt Replay → Prüfung innerhalb der Sperre ergänzt.
- Gleiches Muster bei Zahlungen → ebenso behoben.
- Status-Badges (Warnung/Erfolg/Fehler) unterschritten 4,5:1 → eigene Text-Tokens.
- Chat-Ansicht stürzte ab, weil `scrollIntoView()` in aktuellem Chromium ein Promise zurückgibt und als Effekt-Cleanup interpretiert wurde → Effekte mit Blockrumpf.

## Nicht automatisiert getestet / verbleibende Risiken

- **LLM-Pfad** (Suche und Assistent mit echtem `ANTHROPIC_API_KEY`): kein Schlüssel vorhanden; nur Basismodus und Validierungslogik getestet.
- **SMTP, S3/MinIO, ClamAV, Web-Push:** Adapter implementiert, aber in dieser Umgebung ohne laufende Dienste nur über Fallbacks (Outbox, lokaler Speicher, „nicht gescannt“, Push deaktiviert) geprüft. Docker-Images konnten hier nicht gebaut werden (keine Registry).
- **Screenreader:** strukturell geprüft (axe, Rollen, Labels, Live-Regionen), aber nicht mit VoiceOver/TalkBack/NVDA manuell.
- **Echte Geräte/Safari/Firefox**, Lasttests und Penetrationstest stehen aus.
- **XRechnung:** nicht mit dem KoSIT-Validator geprüft.
- Kein produktiver Zahlungsanbieter – bewusst (siehe OPEN-ITEMS).

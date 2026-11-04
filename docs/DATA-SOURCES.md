# Datenquellen

## Qualifikationskatalog

**Aktuell:** `packages/db/data/qualifications.dev-seed.csv` – 174 Einträge, 156 Aliase, manuell kuratiert (Version `dev-seed-2026.11.1`). Die Bezeichnungen orientieren sich an amtlichen Berufsbezeichnungen, sind aber **keine Übernahme einer offiziellen Datenbank** und müssen vor dem Livebetrieb ersetzt bzw. abgeglichen werden.

**Vor Livebetrieb zu prüfen (Lizenz vor Import klären):**

| Quelle | Inhalt | Hinweis |
|---|---|---|
| BIBB – Verzeichnis der anerkannten Ausbildungsberufe | Ausbildungsberufe nach BBiG/HwO | Nutzungsbedingungen/Lizenz der Veröffentlichung prüfen |
| Bundesagentur für Arbeit – BERUFENET / KldB 2010 | Berufsbezeichnungen, Synonyme, Codes | API-/Datenlizenz prüfen; Codes in `Qualification.officialCode` |
| Hochschulkompass (HRK) | Studiengänge | Datenlizenz klären; Katalog ≠ freie Studienplätze |
| Fortbildungsordnungen (BMBF/IHK/HWK) | Meister-/Fortbildungsabschlüsse | |

**Import:** `pnpm --filter @myminijob/db import-catalog -- --file <csv> --version <v> --source "<Quelle>" --license "<Lizenz>"`. IDs bleiben über Versionen stabil (Abgleich über Art + normalisierte Bezeichnung); nicht mehr enthaltene Einträge derselben Quelle werden deaktiviert, nicht gelöscht. Jeder Import wird mit Checksumme in `CatalogImport` protokolliert.

**Abgrenzung:** Der Katalog beschreibt Abschlüsse. Tatsächlich freie Ausbildungs- oder Studienplätze sind ausschließlich echte Inserate (Beschäftigungsart „Ausbildung“).

## Ortsverzeichnis

**Aktuell:** `packages/db/data/places.seed.ts` – 112 deutsche Städte mit ungefähren Stadtmitte-Koordinaten und je einer repräsentativen PLZ (Entwicklungsdaten). Entfernungen werden als „ca. … km“ zwischen Ortsmitten angezeigt. Unbekannte Orte führen zu einer reinen Namenssuche **ohne** Entfernungsangabe.

**Vor Livebetrieb:** vollständiges, lizenziertes PLZ-/Ortsverzeichnis importieren, z. B. GeoNames „DE“-Postleitzahlen (CC BY 4.0, Namensnennung) oder OpenGeoDB.

## Mindestlohn

`MINIMUM_WAGE_TABLE` in `packages/core/src/config.ts` (13,90 € ab 01.01.2026, 14,60 € ab 01.01.2027 laut Bundesregierung). Bei Änderungen der Mindestlohnverordnung anpassen.

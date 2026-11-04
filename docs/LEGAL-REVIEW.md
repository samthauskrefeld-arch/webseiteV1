# Rechtliche Prüfpunkte vor dem Livebetrieb

Diese Software enthält **keine geprüfte Rechtssicherheit**. Alle Texte unter `/rechtliches/*` sind als Entwurf gekennzeichnet und enthalten Platzhalter. Im Code sind betroffene Stellen mit `LEGAL_REVIEW` markiert (`grep -rn LEGAL_REVIEW`). Folgende Punkte sind durch eine Fachanwältin/einen Fachanwalt bzw. Steuerberatung zu klären:

| Thema | Umsetzung im Code | Zu klären |
|---|---|---|
| **Arbeitsvermittlung (SGB III, §§ 292 ff.)** | Plattform vermittelt, erhebt 1,00 € vom Inseratsteller, keine Gebühr für Bewerber | Einordnung als private Arbeitsvermittlung, Vergütungsgrenzen, Pflichten, Vermittlung in Ausbildung |
| **Vertragsschluss & Button-Lösung (§ 312j BGB)** | Schaltfläche „Zahlungspflichtig zusagen (1,00 €)“, vorher Gebühr, Inserat und Person; Hinweisversion wird gespeichert | Exakte Beschriftung, Pflichtinformationen, Zeitpunkt des kostenpflichtigen Vertrags (Zusage vs. Annahme durch Person) |
| **Gebührenereignis** | Gebühr entsteht erst, wenn die Person annimmt (`MediationEvent.CONFIRMED`); 7 Tage Antwortfrist | Ist „Annahme der Zusage“ die richtige Definition einer erfolgreichen Vermittlung? |
| **Widerrufsrecht (§§ 312g, 355 BGB)** | Platzhalterseite `/rechtliches/widerruf` | Besteht ein Widerrufsrecht für Verbraucher, Erlöschen, amtliches Muster einbinden |
| **Steuern / Rechnungen (§ 14 UStG, § 33 UStDV, § 19 UStG)** | `INVOICE_TAX_MODE` = REGULAR (19 % enthalten) oder KLEINUNTERNEHMER; Kleinbetragsrechnung ohne Empfängeradresse möglich; Stornorechnungen | Steuerlicher Status des Betreibers, Pflichtangaben, Sammelrechnungen statt Einzelrechnungen à 1 € |
| **E-Rechnung (B2B)** | UBL-/XRechnung-Struktur als Entwurf | Ausstellungspflichten ab 2027/2028, Validierung (KoSIT), Kleinbetrags-Ausnahme |
| **Zahlungsabwicklung** | nur Testadapter | Zahlungsdienstleister, ZAG, AGB des PSP |
| **Storno/Erstattung** | Streitfall innerhalb 14 Tagen, Entscheidung durch Admin | Fristen, Gründe, Verbraucherrechte |
| **DSGVO** | Privacy by Design, Sichtbarkeitssteuerung, Export, Löschung (Anonymisierung), Einwilligungen protokolliert, keine Tracking-Cookies | Verzeichnis der Verarbeitungstätigkeiten, AV-Verträge (Hosting, Mail, S3, KI), Drittlandtransfer (KI-Anbieter), Löschfristen, DSFA |
| **Digital Services Act** | Melden, begründete Moderationsentscheidungen mit Benachrichtigung, Audit-Log | Melde- und Abhilfeverfahren, Transparenzpflichten, Kontaktstelle |
| **Arbeits- und Mindestlohnrecht** | Pflicht-Stundenlohn, Warnung unter Mindestlohn (13,90 € ab 01.01.2026, 14,60 € ab 01.01.2027), keine Barzahlung | Haftung/Pflichten bei rechtswidrigen Inseraten, Scheinselbstständigkeit, Jugendarbeitsschutz |
| **Begriff „Minijob“** | Startseite erklärt, dass „Minijob“ ein Name und keine Rechtsform ist; Beschäftigungsarten getrennt | Marken-/Irreführungsrisiko |
| **Impressum (§ 5 DDG)** | Platzhalter aus `OPERATOR_*` | Vollständige Angaben |
| **AGG** | Freitext-Moderation über Meldungen | Diskriminierungsfreie Inserate, Prüfprozesse |
| **KI-Verordnung (EU AI Act)** | Assistent kennzeichnet sich, keine automatisierten Entscheidungen über Bewerbungen | Transparenzpflichten, Einordnung |

/**
 * DRAFT legal texts with placeholders. They are NOT legally reviewed and must be replaced
 * or approved by counsel before go-live (see docs/LEGAL-REVIEW.md).
 */
export const OPERATOR = {
  name: process.env.OPERATOR_NAME ?? "[Betreibername]",
  address: process.env.OPERATOR_ADDRESS ?? "[Anschrift]",
  vat: process.env.OPERATOR_VAT_ID ?? "[USt-IdNr.]",
  email: process.env.OPERATOR_EMAIL ?? "[E-Mail]",
};

export const LEGAL: Record<string, { title: string; sections: Array<[string, string]> }> = {
  impressum: {
    title: "Impressum",
    sections: [
      ["Angaben gemäß § 5 DDG", `${OPERATOR.name}\n${OPERATOR.address}`],
      ["Vertreten durch", "[Name der vertretungsberechtigten Person]"],
      ["Kontakt", `E-Mail: ${OPERATOR.email}\nTelefon: [Telefonnummer]`],
      ["Registereintrag", "[Registergericht, Registernummer – falls vorhanden]"],
      ["Umsatzsteuer-ID", OPERATOR.vat],
      ["Verantwortlich für den Inhalt", "[Name, Anschrift]"],
      ["Verbraucherstreitbeilegung", "[Angabe zur Teilnahme an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle – vor Livebetrieb prüfen]"],
    ],
  },
  agb: {
    title: "Allgemeine Geschäftsbedingungen (Entwurf)",
    sections: [
      ["1. Geltungsbereich", `Diese AGB regeln die Nutzung der Plattform „My Minijob“ von ${OPERATOR.name}. Die Plattform bringt Personen, die Tätigkeiten anbieten (Inseratsteller), und Personen, die sich darauf bewerben (Bewerber), zusammen.`],
      ["2. Leistung der Plattform", "My Minijob stellt Inserate, Bewerbungsfunktionen, Chat und Rechnungen für die eigene Vermittlungsgebühr bereit. My Minijob wird nicht Vertragspartei der zwischen den Nutzern vereinbarten Tätigkeit, zahlt keine Vergütung aus und übernimmt keine Arbeitgeberpflichten. [Rechtliche Einordnung als Arbeitsvermittlung nach SGB III prüfen.]"],
      ["3. Kosten", "Registrierung, Bewerbungen und das Einstellen von Inseraten sind kostenlos. Für jede erfolgreiche Vermittlung schuldet der Inseratsteller eine Vermittlungsgebühr von 1,00 € (brutto) pro vermittelter Person. Die Gebühr entsteht, wenn der Inseratsteller über die Schaltfläche „Zahlungspflichtig zusagen (1,00 €)“ verbindlich zusagt und die Person die Zusage innerhalb von 7 Tagen annimmt. [Vertragsschluss, Fälligkeit und Zahlungsweg vor Livebetrieb prüfen.]"],
      ["4. Storno und Erstattung", "Erscheint eine vermittelte Person nicht oder wird die Vermittlung einvernehmlich aufgehoben, kann innerhalb von 14 Tagen ein Streitfall eröffnet werden. Bei berechtigtem Anliegen wird die Gebühr erstattet und eine Stornorechnung erstellt."],
      ["5. Pflichten der Nutzer", "Inserate müssen wahr sein, einen verbindlichen Stundenlohn nennen und geltendes Recht beachten (u. a. Mindestlohn-, Arbeitszeit-, Jugendarbeitsschutz- und Steuerrecht). Diskriminierende, irreführende oder rechtswidrige Inhalte sind verboten. Barzahlung wird nicht als Plattformoption angeboten."],
      ["6. Moderation", "Wir können Inhalte bei Verstößen einschränken oder Konten sperren. Betroffene werden mit Begründung informiert und können widersprechen. [Anforderungen des Digital Services Act prüfen.]"],
      ["7. Haftung", "[Haftungsregelung durch Rechtsberatung formulieren lassen.]"],
      ["8. Schlussbestimmungen", "[Anwendbares Recht, Gerichtsstand – vor Livebetrieb prüfen.]"],
    ],
  },
  datenschutz: {
    title: "Datenschutzerklärung (Entwurf)",
    sections: [
      ["Verantwortlicher", `${OPERATOR.name}, ${OPERATOR.address}, ${OPERATOR.email}\nDatenschutzbeauftragte/r: [falls erforderlich]`],
      ["Welche Daten wir verarbeiten", "Kontodaten (E-Mail, Benutzername, Passwort-Hash), Profil- und Lebenslaufangaben, hochgeladene Dokumente, Inserate, Bewerbungen, Chatnachrichten, Rechnungsdaten, technische Protokolle (gekürzt), Einwilligungen."],
      ["Zwecke und Rechtsgrundlagen", "Bereitstellung der Plattform und Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO), gesetzliche Aufbewahrung von Rechnungen (lit. c), Sicherheit und Missbrauchsabwehr (lit. f), optionale Funktionen wie Standortsuche oder KI-Assistent nur mit Einwilligung bzw. auf Anfrage (lit. a/b). [Vor Livebetrieb vollständig prüfen.]"],
      ["Sichtbarkeit", "Du steuerst je Angabe, ob sie öffentlich, nur bei Bewerbungen oder nur für dich sichtbar ist. E-Mail-Adressen werden anderen Nutzern nicht angezeigt."],
      ["Empfänger / Auftragsverarbeiter", "[Hosting-Anbieter, E-Mail-Versand, Objektspeicher, KI-Anbieter (bei aktivierter KI: Anthropic), ggf. Zahlungsdienstleister – mit AV-Verträgen und Angaben zu Drittlandübermittlungen ergänzen.]"],
      ["Speicherdauer", "Kontodaten bis zur Löschung des Kontos; Rechnungen gemäß gesetzlicher Aufbewahrungsfristen; Sicherheitsprotokolle [Frist eintragen]."],
      ["Deine Rechte", "Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Widerruf von Einwilligungen, Beschwerde bei einer Aufsichtsbehörde. Export und Löschung kannst du selbst unter „Einstellungen“ auslösen."],
      ["Cookies", "Wir verwenden ein technisch notwendiges Sitzungs-Cookie (httpOnly) und lokale Speicherung für Darstellungseinstellungen. Keine Tracking- oder Werbe-Cookies."],
    ],
  },
  gebuehren: {
    title: "Gebühreninformationen",
    sections: [
      ["Kostenlos", "Registrierung, Lebenslauf, Bewerbungen, Chat und das Einstellen, Bearbeiten und Veröffentlichen von Inseraten."],
      ["Vermittlungsgebühr: 1,00 € pro Person", "Nur für Inseratsteller, nur bei bestätigter Vermittlung: (1) Du sagst einer Person über „Zahlungspflichtig zusagen (1,00 €)“ verbindlich zu, (2) die Person nimmt innerhalb von 7 Tagen an. Erst dann entsteht die Gebühr – genau einmal pro vermittelter Person."],
      ["Keine Gebühr fällt an, wenn …", "… die Person ablehnt, nicht rechtzeitig antwortet oder du deine Zusage zurücknimmst, bevor sie angenommen wurde."],
      ["Rechnung und Zahlung", "Für jede Gebühr erhältst du eine Rechnung (PDF, zusätzlich als E-Rechnung im XML-Format) unter „Mein Konto › Rechnungen“. [Zahlungswege und Steuerausweis vor Livebetrieb festlegen.]"],
      ["Vergütung der Tätigkeit", "Die Bezahlung der Arbeit ist nicht Teil der Gebühr. Ihr vereinbart und zahlt sie direkt untereinander; My Minijob verwaltet keine Löhne."],
    ],
  },
  widerruf: {
    title: "Widerrufsbelehrung und Verbraucherinformationen (Entwurf)",
    sections: [
      ["Hinweis", "Dieser Abschnitt ist ein Platzhalter. Ob und in welchem Umfang Verbrauchern bei der Vermittlungsgebühr ein Widerrufsrecht zusteht und wann es ggf. erlischt, muss vor Livebetrieb rechtlich geprüft werden. Für die Belehrung ist das amtliche Muster (Anlage 1 zu Art. 246a § 1 Abs. 2 EGBGB) zu verwenden."],
      ["Widerrufsrecht", "[Belehrungstext nach amtlichem Muster einfügen]"],
      ["Muster-Widerrufsformular", "[Formular nach Anlage 2 zu Art. 246a EGBGB einfügen]"],
      ["Wesentliche Merkmale der Leistung", "Vermittlung einer Person für ein Inserat; Preis 1,00 € inkl. ggf. anfallender Umsatzsteuer pro vermittelter Person."],
    ],
  },
};

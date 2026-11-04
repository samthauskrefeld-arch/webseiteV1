import { describe, expect, it } from "vitest";
import { searchQualifications } from "@/server/services/catalog";
import { changeListingStatus, createListing } from "@/server/services/listings";
import { parseNaturalQuery, searchListings } from "@/server/services/search";
import { listingInput, makeUser } from "./helpers";

describe("Qualifikationskatalog-Autocomplete", () => {
  it("„Ele“ liefert Elektroniker-Berufe (Präfix)", async () => {
    const hits = await searchQualifications("Ele");
    expect(hits.length).toBeGreaterThan(3);
    expect(hits.slice(0, 5).every((h) => /^Elektr/.test(h.name))).toBe(true);
  });
  it("„BWL“ liefert Betriebswirtschaftslehre über Alias", async () => {
    const [first] = await searchQualifications("BWL");
    expect(first?.name).toBe("Betriebswirtschaftslehre");
    expect(first?.matchedAlias).toBe("BWL");
  });
  it("Mechatroniker und Elektroniker sind getrennte Einträge", async () => {
    const [mech] = await searchQualifications("Mechatroniker");
    expect(mech?.name).toBe("Mechatroniker/-in");
    const elek = await searchQualifications("Elektroniker");
    expect(elek.map((h) => h.id)).not.toContain(mech!.id);
  });
  it("umgangssprachlicher Begriff ist nur Alias auf einen amtlichen Eintrag", async () => {
    const [hit] = await searchQualifications("Elektriker");
    expect(hit?.name).toBe("Elektroniker/-in – Fachrichtung Energie- und Gebäudetechnik");
    expect(hit?.matchedAlias).toBe("Elektriker");
  });
  it("toleriert Tippfehler (Trigramm)", async () => {
    const hits = await searchQualifications("Mechatronicker");
    expect(hits.map((h) => h.name)).toContain("Mechatroniker/-in");
  });
  it("filtert nach Art", async () => {
    const hits = await searchQualifications("Elektro", ["STUDIENFACH"]);
    expect(hits.every((h) => h.kind === "STUDIENFACH")).toBe(true);
    expect(hits.map((h) => h.name)).toContain("Elektrotechnik");
  });
});

describe("KI-Suche (regelbasierter Pfad ohne API-Schlüssel)", () => {
  it("parst Beispielanfragen und findet nur echte, veröffentlichte Inserate", async () => {
    const owner = await makeUser({ prefix: "own" });
    const { listing } = await createListing(owner, listingInput({ title: "Gartenhilfe Krefeld Süd", hourlyWageCents: 1450 }));
    const { listing: cheap } = await createListing(owner, listingInput({ title: "Gartenhilfe günstig", hourlyWageCents: 1200 }));
    const { listing: draft } = await createListing(owner, listingInput({ title: "Gartenhilfe Entwurf", hourlyWageCents: 2000 }));
    await changeListingStatus(owner, listing.id, "publish");
    await changeListingStatus(owner, cheap.id, "publish");
    void draft; // stays DRAFT → must never appear

    const parsed = await parseNaturalQuery("Gartenarbeit ab 12,50 Euro Raum Krefeld", { clientKey: "test" });
    expect(parsed.parser).toBe("rules");
    expect(parsed.query).toMatchObject({ category: "GARTEN", minHourlyCents: 1250, location: "Krefeld", radiusKm: 25 });
    const res = await searchListings(parsed.query);
    const ids = res.items.map((i) => i.id);
    expect(ids).toContain(listing.id);
    expect(ids).not.toContain(cheap.id); // 12,00 < 12,50
    expect(ids).not.toContain(draft.id);
    const hit = res.items.find((i) => i.id === listing.id)!;
    expect(hit.distanceKm).toBe(0); // same city centre → 0 km, real computation
  });

  it("„Wochenendjob Dortmund mindestens 15 Euro“ erkennt Ort über das Ortsverzeichnis", async () => {
    const parsed = await parseNaturalQuery("Wochenendjob Dortmund mindestens 15 Euro", { clientKey: "test" });
    expect(parsed.query).toMatchObject({ weekend: true, location: "Dortmund", minHourlyCents: 1500 });
  });

  it("erfindet keine Entfernungen bei unbekanntem Ort", async () => {
    const res = await searchListings({ location: "Kleinkleckersdorf" });
    expect(res.place).toBeNull();
    expect(res.locationNote).toMatch(/nicht in unserem Ortsverzeichnis/);
    expect(res.items.every((i) => i.distanceKm === null)).toBe(true);
  });

  it("Radiusfilter schließt weit entfernte Orte aus", async () => {
    const owner = await makeUser({ prefix: "rad" });
    const { listing } = await createListing(owner, listingInput({ title: "Gartenhilfe München", city: "München" }));
    await changeListingStatus(owner, listing.id, "publish");
    const res = await searchListings({ location: "Krefeld", radiusKm: 50, category: "GARTEN" });
    expect(res.items.map((i) => i.id)).not.toContain(listing.id);
  });
});

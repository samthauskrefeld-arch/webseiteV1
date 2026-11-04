import { Ban, Check, HandCoins, MessageCircle, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CategoryGrid } from "@/components/home/categories";
import { ListingCard } from "@/components/listing/listing-card";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { latestListings } from "@/server/services/listings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const listings = await latestListings(6);
  return (
    <div className="space-y-14">
      <section className="pt-2 lg:pt-6">
        <p className="mb-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-accent-text">Deutschlandweit · kostenlos bewerben</p>
        <h1 className="max-w-2xl text-[34px] leading-[40px] sm:text-[44px] sm:leading-[52px]">Finde den Job, der zu deinem Leben passt</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-7 text-muted">Beschreibe einfach, was du suchst – unsere KI-Suche versteht Tätigkeit, Ort, Stundenlohn und Arbeitszeit. Es werden nur echte, aktive Inserate angezeigt.</p>
        <div className="mt-8 max-w-3xl">
          <SearchBar large />
        </div>
      </section>

      <section aria-labelledby="cats">
        <h2 id="cats" className="mb-5">Kategorien</h2>
        <CategoryGrid />
      </section>

      <section aria-labelledby="latest">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="latest">Neue Inserate</h2>
          <Link href="/suche" className="text-[15px] font-semibold text-accent-text hover:underline">
            Alle ansehen
          </Link>
        </div>
        {listings.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <Empty icon={<Search className="size-5" />} title="Noch keine Inserate">
            Sei die erste Person, die hier ein Inserat einstellt.
          </Empty>
        )}
      </section>

      <section aria-labelledby="how" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[20px] border border-border bg-surface p-6">
          <h2 id="how" className="mb-4">So funktioniert’s</h2>
          <ul className="space-y-3 text-[15px]">
            {[
              [Check, "Bewerbungen sind kostenlos – einmal Lebenslauf anlegen, mit wenigen Schritten bewerben."],
              [HandCoins, "Inserieren ist kostenlos. Erst wenn eine Vermittlung bestätigt ist, zahlt der Inseratsteller 1,00 € pro Person."],
              [MessageCircle, "Direkter Kontakt per Chat – ohne Weitergabe deiner E-Mail-Adresse."],
              [ShieldCheck, "Transparente Vergütung: Jedes Inserat nennt einen verbindlichen Stundenlohn."],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Check;
              return (
                <li key={i} className="flex gap-3">
                  <I className="mt-0.5 size-5 shrink-0 text-success-text" aria-hidden />
                  <span>{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-[20px] border border-border bg-surface p-6">
          <h2 className="mb-4">Gut zu wissen</h2>
          <ul className="space-y-3 text-[15px]">
            {[
              "My Minijob zahlt keine Löhne aus. Die Vergütung vereinbart und zahlt ihr direkt untereinander.",
              "Wir garantieren keine Vermittlung und prüfen Inserate nicht vorab inhaltlich – melde Auffälliges bitte.",
              "„Minijob“ ist bei uns ein Name, keine Rechtsform: Angebote können auch Teilzeit, Vollzeit, Ausbildung oder Einzelaufträge sein.",
              "Barzahlung ist keine Zahlungsoption auf der Plattform.",
            ].map((text, i) => (
              <li key={i} className="flex gap-3">
                <Ban className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/konto/inserate/neu">Inserat erstellen</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/rechtliches/gebuehren">Gebühren im Detail</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

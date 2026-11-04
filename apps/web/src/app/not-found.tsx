import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <h1>Seite nicht gefunden</h1>
      <p className="mt-3 text-[15px] text-muted">Das Inserat wurde möglicherweise geschlossen oder der Link ist falsch.</p>
      <Button asChild className="mt-6">
        <Link href="/">Zur Startseite</Link>
      </Button>
    </div>
  );
}

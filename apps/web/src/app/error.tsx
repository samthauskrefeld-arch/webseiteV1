"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <h1>Da ist etwas schiefgelaufen</h1>
      <p className="mt-3 text-[15px] text-muted">Bitte versuche es erneut. Wenn der Fehler bleibt, melde dich beim Support.</p>
      <Button className="mt-6" onClick={reset}>
        Erneut versuchen
      </Button>
    </div>
  );
}

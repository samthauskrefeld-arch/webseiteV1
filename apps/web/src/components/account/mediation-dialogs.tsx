"use client";
import { Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";

export function ReviewDialog({ target, onClose, onDone }: { target: { id: string } | null; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()} title="Bewertung abgeben" description="Bewertungen sind nur nach bestätigtem Abschluss möglich und werden moderiert.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api<{ moderated: boolean }>(`/mediations/${target!.id}/reviews`, { body: { rating, text } });
            toast(r.moderated ? "Danke! Deine Bewertung wird vor Veröffentlichung geprüft." : "Danke für deine Bewertung!");
            onClose();
            onDone();
          } catch (err) {
            toast(err instanceof ApiClientError ? err.message : "Fehler", "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Sterne</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
                <Star className={`size-9 ${n <= rating ? "fill-[#f5b301] text-[#f5b301]" : "text-border"}`} aria-label={`${n} Sterne`} />
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Kommentar" optional>
          {(id) => <Textarea id={id} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          Bewertung senden
        </Button>
      </form>
    </Dialog>
  );
}

export function DisputeDialog({ target, onClose, onDone }: { target: { id: string } | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()} title="Problem melden / Storno" description="Z. B. bei Nichterscheinen. Unser Team prüft den Fall; bei Berechtigung wird die Gebühr erstattet.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/mediations/${target!.id}/dispute`, { body: { reason } });
            toast("Streitfall eröffnet");
            onClose();
            onDone();
          } catch (err) {
            toast(err instanceof ApiClientError ? (err.fields?.reason ?? err.message) : "Fehler", "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Was ist passiert?">{(id) => <Textarea id={id} minLength={10} maxLength={1500} required value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <Button type="submit" className="w-full" loading={busy}>
          Absenden
        </Button>
      </form>
    </Dialog>
  );
}

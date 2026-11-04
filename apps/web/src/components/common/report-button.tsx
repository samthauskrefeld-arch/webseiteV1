"use client";
import { Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";
import { useSession } from "@/lib/session";

const REASONS = { SPAM: "Spam", BETRUG: "Betrugsverdacht", BELEIDIGUNG: "Beleidigung/Belästigung", DISKRIMINIERUNG: "Diskriminierung", ILLEGAL: "Rechtswidriger Inhalt", FALSCHE_ANGABEN: "Falsche Angaben", SONSTIGES: "Sonstiges" };

export function ReportButton({ targetType, targetId, compact }: { targetType: "LISTING" | "USER" | "MESSAGE" | "REVIEW"; targetId: string; compact?: boolean }) {
  const { me } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<keyof typeof REASONS>("SPAM");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  return (
    <>
      <Button variant="ghost" size={compact ? "icon" : "sm"} onClick={() => setOpen(true)} aria-label="Melden">
        <Flag className="size-4" aria-hidden /> {!compact && "Melden"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Inhalt melden" description="Unser Team prüft die Meldung. Bei Gefahr wende dich bitte an die Polizei (110).">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/reports", { body: { targetType, targetId, reason, details } });
              toast("Danke, die Meldung ist eingegangen.");
              setOpen(false);
            } catch (err) {
              toast(err instanceof ApiClientError ? err.message : "Meldung fehlgeschlagen", "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Grund">
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REASONS)}>
                {Object.entries(REASONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Details" optional>
            {(id) => <Textarea id={id} maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} />}
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            Meldung senden
          </Button>
        </form>
      </Dialog>
    </>
  );
}

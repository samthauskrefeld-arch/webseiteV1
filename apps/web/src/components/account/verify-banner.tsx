"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { api, ApiClientError } from "@/lib/api";
import { useSession } from "@/lib/session";

export function VerifyBanner() {
  const { me } = useSession();
  const [sent, setSent] = useState<string | null>(null);
  if (!me || me.emailVerified) return null;
  return (
    <Notice tone="warning" title="Bitte bestätige deine E-Mail-Adresse">
      <p>Erst danach kannst du dich bewerben, Inserate veröffentlichen und Nachrichten senden.</p>
      {sent ? (
        <p className="mt-1 font-medium">{sent}</p>
      ) : (
        <Button
          variant="link"
          onClick={async () => {
            try {
              await api("/auth/resend-verification", { method: "POST" });
              setSent("Neuer Link ist unterwegs.");
            } catch (e) {
              setSent(e instanceof ApiClientError ? e.message : "Fehler");
            }
          }}
        >
          Bestätigungslink erneut senden
        </Button>
      )}
      {process.env.NODE_ENV !== "production" && (
        <a href="/dev/mails" className="ml-3 text-[13px] underline">
          Dev-Postfach öffnen
        </a>
      )}
    </Notice>
  );
}

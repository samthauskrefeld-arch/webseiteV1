"use client";
import { useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api, ApiClientError } from "@/lib/api";

export default function Page() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthCard title="Passwort vergessen" subtitle="Wir senden dir einen Link zum Zurücksetzen.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api<{ message: string }>("/auth/password-reset/request", { body: { email } });
            setMsg({ tone: "success", text: r.message });
          } catch (err) {
            setMsg({ tone: "error", text: err instanceof ApiClientError ? err.message : "Fehler" });
          } finally {
            setBusy(false);
          }
        }}
      >
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Field label="E-Mail">{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Button type="submit" className="w-full" loading={busy}>
          Link anfordern
        </Button>
      </form>
    </AuthCard>
  );
}

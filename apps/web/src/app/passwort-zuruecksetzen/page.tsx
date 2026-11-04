"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api, ApiClientError } from "@/lib/api";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const [busy, setBusy] = useState(false);
  if (state.ok)
    return (
      <div className="space-y-4">
        <Notice tone="success" title="Passwort geändert">Aus Sicherheitsgründen wurdest du auf allen Geräten abgemeldet.</Notice>
        <Button asChild className="w-full">
          <Link href="/anmelden">Jetzt anmelden</Link>
        </Button>
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/auth/password-reset/confirm", { body: { token, password } });
          setState({ ok: true });
        } catch (err) {
          setState({ error: err instanceof ApiClientError ? (err.fields?.password ?? err.message) : "Fehler" });
        } finally {
          setBusy(false);
        }
      }}
    >
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Neues Passwort" hint="Mindestens 10 Zeichen, mit Ziffer oder Sonderzeichen.">
        {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        Passwort speichern
      </Button>
    </form>
  );
}
export default function Page() {
  return (
    <AuthCard title="Neues Passwort">
      <Suspense>
        <Form />
      </Suspense>
    </AuthCard>
  );
}

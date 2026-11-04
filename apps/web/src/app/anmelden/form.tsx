"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api, ApiClientError } from "@/lib/api";
import { useSession } from "@/lib/session";

export const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/konto");

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/auth/login", { body: { email, password } });
          await refresh();
          router.push(safeNext(sp.get("next")));
          router.refresh();
        } catch (err) {
          setError(err instanceof ApiClientError ? err.message : "Anmeldung fehlgeschlagen");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="E-Mail">{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Passwort">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      <Button type="submit" className="w-full" loading={busy}>
        Anmelden
      </Button>
      <div className="flex justify-between text-[14px]">
        <Link href="/passwort-vergessen" className="text-accent-text hover:underline">
          Passwort vergessen?
        </Link>
        <Link href={`/registrieren${sp.get("next") ? `?next=${encodeURIComponent(sp.get("next")!)}` : ""}`} className="font-semibold text-accent-text hover:underline">
          Konto erstellen
        </Link>
      </div>
    </form>
  );
}

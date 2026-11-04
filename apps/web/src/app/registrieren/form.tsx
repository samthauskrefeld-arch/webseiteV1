"use client";
import { ROLE_LABELS, type RoleType } from "@myminijob/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api, ApiClientError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { safeNext } from "../anmelden/form";

export function RegisterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { refresh } = useSession();
  const [f, setF] = useState({ email: "", password: "", username: "", acceptTerms: false, initialRole: "APPLICANT" as RoleType });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setErrors({});
        try {
          await api("/auth/register", { body: f });
          await refresh();
          router.push(safeNext(sp.get("next")) === "/konto" ? "/konto?willkommen=1" : safeNext(sp.get("next")));
          router.refresh();
        } catch (err) {
          if (err instanceof ApiClientError) {
            setErrors(err.fields ?? {});
            setError(err.message);
          } else setError("Registrierung fehlgeschlagen");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Benutzername" hint="Wird öffentlich angezeigt – dein echter Name ist nicht nötig." error={errors.username}>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.username} autoComplete="username" required value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />}
      </Field>
      <Field label="E-Mail" error={errors.email}>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
      </Field>
      <Field label="Passwort" hint="Mindestens 10 Zeichen, mit Ziffer oder Sonderzeichen." error={errors.password}>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.password} type="password" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Womit möchtest du starten?</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["APPLICANT", "PRIVATE_POSTER", "BUSINESS_POSTER"] as RoleType[]).map((r) => (
            <label key={r} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[14px] border px-2 text-center text-[14px] font-medium transition-colors ${f.initialRole === r ? "border-primary bg-primary text-on-primary" : "border-border hover:bg-surface-2"}`}>
              <input type="radio" name="role" value={r} className="sr-only" checked={f.initialRole === r} onChange={() => setF({ ...f, initialRole: r })} />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[13px] text-muted">Du kannst die Rolle jederzeit im Konto wechseln.</p>
      </fieldset>
      <Checkbox
        checked={f.acceptTerms}
        onChange={(e) => setF({ ...f, acceptTerms: e.target.checked })}
        label={
          <>
            Ich akzeptiere die{" "}
            <Link href="/rechtliches/agb" className="underline" target="_blank">
              AGB
            </Link>{" "}
            und habe die{" "}
            <Link href="/rechtliches/datenschutz" className="underline" target="_blank">
              Datenschutzhinweise
            </Link>{" "}
            gelesen.
          </>
        }
      />
      {errors.acceptTerms && <p className="text-[13px] font-medium text-error-text">{errors.acceptTerms}</p>}
      <Button type="submit" className="w-full" loading={busy}>
        Kostenlos registrieren
      </Button>
      <p className="text-center text-[14px] text-muted">
        Schon registriert?{" "}
        <Link href="/anmelden" className="font-semibold text-accent-text hover:underline">
          Anmelden
        </Link>
      </p>
    </form>
  );
}

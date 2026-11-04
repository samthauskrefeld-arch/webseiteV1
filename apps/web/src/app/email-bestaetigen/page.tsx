"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiClientError } from "@/lib/api";
import { useSession } from "@/lib/session";

function Verify() {
  const token = useSearchParams().get("token");
  const { refresh } = useSession();
  const [state, setState] = useState<"busy" | "ok" | "error">("busy");
  const [msg, setMsg] = useState("");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState("error");
      setMsg("Kein Bestätigungslink gefunden.");
      return;
    }
    api("/auth/verify-email", { body: { token } })
      .then(async () => {
        setState("ok");
        await refresh();
      })
      .catch((e) => {
        setState("error");
        setMsg(e instanceof ApiClientError ? e.message : "Bestätigung fehlgeschlagen");
      });
  }, [token, refresh]);
  return state === "busy" ? (
    <Spinner label="Wird bestätigt …" />
  ) : state === "ok" ? (
    <div className="space-y-4">
      <Notice tone="success" title="E-Mail bestätigt">Du kannst dich jetzt bewerben und Inserate veröffentlichen.</Notice>
      <Button asChild className="w-full">
        <Link href="/konto">Zu meinem Konto</Link>
      </Button>
    </div>
  ) : (
    <Notice tone="error">{msg}</Notice>
  );
}
export default function Page() {
  return (
    <AuthCard title="E-Mail bestätigen">
      <Suspense>
        <Verify />
      </Suspense>
    </AuthCard>
  );
}

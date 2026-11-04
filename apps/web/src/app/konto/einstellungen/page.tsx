"use client";
import { NOTIFICATION_LABELS, type NotificationType } from "@myminijob/core";
import { Download, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Switch } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/cn";

type Pref = { type: NotificationType; email: boolean; push: boolean; inApp: boolean };
type Theme = "system" | "light" | "dark";

export default function Page() {
  const [prefs, setPrefs] = useState<Pref[] | null>(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const toast = useToast();
  useEffect(() => {
    api<{ prefs: Pref[] }>("/me/notification-preferences").then((r) => setPrefs(r.prefs));
    api<{ publicKey: string | null }>("/push/public-key").then((r) => setPushKey(r.publicKey));
    try {
      setTheme((localStorage.getItem("mmj_theme") as Theme) ?? "system");
    } catch {}
  }, []);
  const applyTheme = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "system") {
        localStorage.removeItem("mmj_theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("mmj_theme", t);
        document.documentElement.dataset.theme = t;
      }
    } catch {}
  };
  const savePrefs = async (next: Pref[]) => {
    setPrefs(next);
    try {
      await api("/me/notification-preferences", { method: "PUT", body: { prefs: next } });
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
  };
  const enablePush = async () => {
    try {
      if (!pushKey || !("serviceWorker" in navigator)) throw new Error("Push wird nicht unterstützt");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKey });
      await api("/me/push-subscriptions", { body: sub.toJSON() });
      toast("Push-Benachrichtigungen aktiviert");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Fehler", "error");
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Einstellungen" />
      <Card>
        <CardBody>
          <h2 className="mb-4 text-[20px]">Darstellung</h2>
          <div role="radiogroup" aria-label="Farbschema" className="grid grid-cols-3 gap-2">
            {(
              [
                ["system", "System", Monitor],
                ["light", "Hell", Sun],
                ["dark", "Dunkel", Moon],
              ] as const
            ).map(([v, label, Icon]) => (
              <button key={v} role="radio" aria-checked={theme === v} onClick={() => applyTheme(v)} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-[14px] border font-medium", theme === v ? "border-primary bg-primary text-on-primary" : "border-border hover:bg-surface-2")}>
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-1 text-[20px]">Benachrichtigungen</h2>
          <p className="mb-4 text-[14px] text-muted">E-Mails enthalten nie Nachrichteninhalte.</p>
          {!pushKey && <p className="mb-3 text-[13px] text-muted">Push ist auf diesem Server nicht konfiguriert.</p>}
          {pushKey && (
            <Button variant="secondary" size="sm" className="mb-4" onClick={enablePush}>
              Push auf diesem Gerät aktivieren
            </Button>
          )}
          {prefs && (
            <table className="w-full text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="py-2 font-medium">Ereignis</th>
                  <th className="w-16 py-2 text-center font-medium">App</th>
                  <th className="w-16 py-2 text-center font-medium">E-Mail</th>
                  <th className="w-16 py-2 text-center font-medium">Push</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {prefs.map((p) => (
                  <tr key={p.type}>
                    <td className="py-2.5 pr-2">{NOTIFICATION_LABELS[p.type]}</td>
                    {(["inApp", "email", "push"] as const).map((ch) => (
                      <td key={ch} className="text-center">
                        <Switch label={`${NOTIFICATION_LABELS[p.type]} per ${ch === "inApp" ? "App" : ch === "email" ? "E-Mail" : "Push"}`} checked={p[ch]} disabled={ch === "push" && !pushKey} onChange={(v) => savePrefs(prefs.map((x) => (x.type === p.type ? { ...x, [ch]: v } : x)))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-[20px]">Datenschutz</h2>
          <p className="text-[15px] text-muted">Lade alle Daten herunter, die wir zu deinem Konto speichern (DSGVO Art. 15 und 20).</p>
          <Button asChild variant="secondary">
            <a href="/api/v1/me/export">
              <Download className="size-4" aria-hidden /> Datenexport (JSON)
            </a>
          </Button>
          <hr className="border-border" />
          <h3>Konto löschen</h3>
          <p className="text-[15px] text-muted">Profil, Lebenslauf, Dateien und Benachrichtigungen werden gelöscht. Rechnungen müssen wir aufgrund gesetzlicher Aufbewahrungspflichten aufbewahren.</p>
          <Button variant="danger" onClick={() => setDel(true)}>
            Konto löschen …
          </Button>
        </CardBody>
      </Card>
      <DeleteDialog open={del} onClose={() => setDel(false)} />
    </div>
  );
}

function DeleteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setMe } = useSession();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Konto endgültig löschen" description="Dieser Schritt kann nicht rückgängig gemacht werden.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await api("/me", { method: "DELETE", body: { password, confirm } });
            setMe(null);
            router.push("/");
            router.refresh();
          } catch (e2) {
            setErr(e2 instanceof ApiClientError ? e2.message : "Fehler");
          } finally {
            setBusy(false);
          }
        }}
      >
        {err && <Notice tone="error">{err}</Notice>}
        <Field label="Passwort">{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <Field label="Zur Bestätigung „LÖSCHEN“ eingeben">{(id) => <Input id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
        <Button type="submit" variant="danger" className="w-full" loading={busy} disabled={confirm !== "LÖSCHEN" || !password}>
          Konto endgültig löschen
        </Button>
      </form>
    </Dialog>
  );
}

import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
/** Development inbox – disabled in production. */
export default async function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const mails = await db().outboxEmail.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const linkify = (t: string) => t.split(/(https?:\/\/\S+)/g).map((p, i) => (p.startsWith("http") ? <a key={i} href={p} className="break-all text-accent-text underline">{p}</a> : p));
  return (
    <div className="space-y-4">
      <h1>Dev-Postfach</h1>
      <p className="text-[15px] text-muted">Nur in der Entwicklung sichtbar. Ohne SMTP werden E-Mails hier gespeichert.</p>
      {mails.map((m) => (
        <article key={m.id} className="rounded-[20px] border border-border bg-surface p-4">
          <p className="text-[13px] text-muted">
            {dateTime(m.createdAt)} · an {m.to} · {m.sentAt ? "per SMTP gesendet" : "nur gespeichert"}
          </p>
          <h2 className="text-[17px]">{m.subject}</h2>
          <p className="mt-2 whitespace-pre-line text-[14px]">{linkify(m.text)}</p>
        </article>
      ))}
    </div>
  );
}

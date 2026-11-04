import { HELP_ARTICLES } from "@myminijob/core";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Hilfe" };
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1>Hilfe</h1>
      <p className="text-[15px] text-muted">Antworten auf häufige Fragen. Du kannst auch jederzeit „My Minijob AI“ unten rechts fragen.</p>
      {HELP_ARTICLES.map((a) => (
        <section key={a.slug} id={a.slug} className="scroll-mt-24 rounded-[20px] border border-border bg-surface p-5">
          <h2 className="mb-2 text-[20px]">{a.title}</h2>
          <p className="text-[15px] leading-7">{a.body}</p>
        </section>
      ))}
    </div>
  );
}

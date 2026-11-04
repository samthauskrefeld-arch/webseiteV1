import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { LEGAL } from "@/lib/legal";

export function generateStaticParams() {
  return Object.keys(LEGAL).map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: PageProps<"/rechtliches/[slug]">): Promise<Metadata> {
  return { title: LEGAL[(await params).slug]?.title ?? "Rechtliches" };
}
export default async function Page({ params }: PageProps<"/rechtliches/[slug]">) {
  const doc = LEGAL[(await params).slug];
  if (!doc) notFound();
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1>{doc.title}</h1>
      <Notice tone="warning" title="Entwurf – nicht rechtsverbindlich">Dieser Text ist ein Entwurf mit Platzhaltern und wird vor dem Livebetrieb juristisch geprüft und ergänzt.</Notice>
      {doc.sections.map(([h, t]) => (
        <section key={h}>
          <h2 className="mb-2 text-[20px]">{h}</h2>
          <p className="whitespace-pre-line text-[15px] leading-7">{t}</p>
        </section>
      ))}
    </article>
  );
}

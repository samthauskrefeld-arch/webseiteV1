import { QUALIFICATION_KIND_LABELS } from "@myminijob/core";
import { Star } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportButton } from "@/components/common/report-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { date } from "@/lib/format";
import { getPublicProfile } from "@/server/services/profile";

export const metadata: Metadata = { title: "Profil", robots: { index: false } };

export default async function Page({ params }: PageProps<"/profil/[username]">) {
  const p = await getPublicProfile(decodeURIComponent((await params).username)).catch(() => null);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-accent/15 text-[24px] font-bold text-accent-text">{p.username.slice(0, 1).toUpperCase()}</span>
        <div>
          <h1>{p.username}</h1>
          <p className="text-[15px] text-muted">
            Mitglied seit {date(p.memberSince)}
            {p.city ? ` · ${p.city}` : ""}
          </p>
          {p.rating && (
            <p className="mt-1 flex items-center gap-1 text-[15px]">
              <Star className="size-4 fill-[#f5b301] text-[#f5b301]" aria-hidden /> {p.rating.average.toLocaleString("de-DE")} ({p.rating.count} Bewertung{p.rating.count === 1 ? "" : "en"})
            </p>
          )}
        </div>
        <div className="ml-auto">
          <ReportButton targetType="USER" targetId={p.userId} compact />
        </div>
      </div>
      {(p.headline || p.about || p.skills.length > 0) && (
        <Card>
          <CardBody className="space-y-2 text-[15px]">
            {p.headline && <p className="font-semibold">{p.headline}</p>}
            {p.about && <p>{p.about}</p>}
            {p.skills.length > 0 && <p className="text-muted">Kompetenzen: {p.skills.join(", ")}</p>}
          </CardBody>
        </Card>
      )}
      {p.qualifications.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-[18px]">Qualifikationen</h2>
            <ul className="space-y-2">
              {p.qualifications.map((q, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  {q.name} <span className="text-[13px] text-muted">{QUALIFICATION_KIND_LABELS[q.kind]}</span>
                  <Badge tone={q.status === "VERIFIED" ? "success" : "neutral"}>{q.status === "VERIFIED" ? "geprüft" : "Selbstangabe"}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      <section>
        <h2 className="mb-3 text-[18px]">Bewertungen</h2>
        {p.reviews.length ? (
          <ul className="space-y-3">
            {p.reviews.map((r) => (
              <li key={r.id} className="rounded-[20px] border border-border bg-surface p-4">
                <p className="flex items-center gap-1" aria-label={`${r.rating} von 5 Sternen`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-4 ${i < r.rating ? "fill-[#f5b301] text-[#f5b301]" : "text-border"}`} aria-hidden />
                  ))}
                  <span className="ml-2 text-[13px] text-muted">
                    {r.author} · {date(r.createdAt)}
                  </span>
                </p>
                {r.text && <p className="mt-2 text-[15px]">{r.text}</p>}
                <div className="mt-1">
                  <ReportButton targetType="REVIEW" targetId={r.id} compact />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted">Noch keine Bewertungen. Bewertungen sind nur nach bestätigt abgeschlossenen Aufträgen möglich.</p>
        )}
      </section>
    </div>
  );
}

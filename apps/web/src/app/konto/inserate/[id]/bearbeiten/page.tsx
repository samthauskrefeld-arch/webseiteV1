import { notFound } from "next/navigation";
import { PageHeader } from "@/components/account/page-header";
import { ListingWizard } from "@/components/listing/listing-wizard";
import { currentUser } from "@/server/current-user";
import { getListing } from "@/server/services/listings";

export default async function Page({ params }: PageProps<"/konto/inserate/[id]/bearbeiten">) {
  const { id } = await params;
  const user = await currentUser();
  const l = await getListing(id, user).catch(() => null);
  if (!l || !l.isOwner) notFound();
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return (
    <>
      <PageHeader title="Inserat bearbeiten" back={`/konto/inserate/${id}`} backLabel="Zurück zum Inserat" />
      <ListingWizard
        listingId={id}
        initial={{
          status: l.status,
          posterType: l.posterType,
          title: l.title,
          description: l.description,
          category: l.category,
          employmentType: l.employmentType,
          remote: l.remote,
          city: l.city,
          postalCode: l.postalCode,
          startDate: iso(l.startDate),
          endDate: iso(l.endDate),
          hoursPerWeek: l.hoursPerWeek,
          hoursTotal: l.hoursTotal,
          scheduleText: l.scheduleText,
          weekend: l.weekend,
          evening: l.evening,
          positions: l.positions,
          hourlyWageCents: l.hourlyWageCents,
          compensationNotes: l.compensationNotes,
          paymentMethod: l.paymentMethod,
          paymentNotes: l.paymentNotes,
          requirements: l.requirements.map((r) => ({ type: r.type, level: r.level, qualificationId: r.qualificationId, text: r.text, label: r.qualification?.name ?? r.text ?? "", kind: r.qualification?.kind })),
        }}
      />
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/account/page-header";
import { ListingWizard } from "@/components/listing/listing-wizard";
export const metadata: Metadata = { title: "Inserat erstellen" };
export default function Page() {
  return (
    <>
      <PageHeader title="Inserat erstellen" back="/konto/inserate" backLabel="Eigene Inserate" />
      <ListingWizard />
    </>
  );
}

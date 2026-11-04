import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResults } from "./results";

export const metadata: Metadata = { title: "Suche" };

export default function SuchePage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}

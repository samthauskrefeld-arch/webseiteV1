import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "./form";
export const metadata: Metadata = { title: "Registrieren" };
export default function Page() {
  return (
    <AuthCard title="Konto erstellen" subtitle="Kostenlos. Ein Konto für Bewerben und Inserieren.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}

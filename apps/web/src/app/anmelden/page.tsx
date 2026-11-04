import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./form";
export const metadata: Metadata = { title: "Anmelden" };
export default function Page() {
  return (
    <AuthCard title="Willkommen zurück" subtitle="Melde dich an, um dich zu bewerben oder Inserate zu verwalten.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}

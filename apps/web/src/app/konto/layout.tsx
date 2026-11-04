import { redirect } from "next/navigation";
import { currentUser } from "@/server/current-user";
export const dynamic = "force-dynamic";
export default async function KontoLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentUser())) redirect("/anmelden?next=/konto");
  return <>{children}</>;
}

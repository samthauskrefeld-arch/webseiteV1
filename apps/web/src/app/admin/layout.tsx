import { notFound } from "next/navigation";
import { currentUser } from "@/server/current-user";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u?.isAdmin) notFound();
  return <>{children}</>;
}

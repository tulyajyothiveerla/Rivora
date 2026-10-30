import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import PortalApp from "@/components/portal-app";

export const metadata: Metadata = { title: "Your RIVORA portal" };
export const instant = false;

export default async function PortalPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/portal");
  return <PortalApp user={user} />;
}

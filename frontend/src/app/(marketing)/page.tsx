import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";

export default async function HomePage() {
  const headersList = await headers();

  const rawHost =
    headersList.get("x-forwarded-host") ||
    headersList.get("host") ||
    "";

  const host = rawHost
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];

  const isAdminDomain =
    host === "adq-soc.click" ||
    host === "www.adq-soc.click" ||
    host.startsWith("admin.");

  if (isAdminDomain) {
    redirect("/admin");
  }

  return <LandingPage />;
}

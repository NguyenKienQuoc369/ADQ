import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";

export default function HomePage() {
  const headersList = headers();
  const host = (headersList.get("x-forwarded-host") || headersList.get("host") || "").toLowerCase();
  if (host.includes("adq-soc.click") || host.startsWith("admin.")) {
    redirect("/admin/login");
  }

  return <LandingPage />;
}


import { headers } from "next/headers";
import { LandingPage } from "@/components/landing-page";
import AdminDashboardPage from "@/app/admin/page";
import AdminLoginPage from "@/app/admin/login/page";

export default async function HomePage() {
  const headersList = await headers();
  const host = (headersList.get("x-forwarded-host") || headersList.get("host") || "").toLowerCase();

  const isAdminDomain = host.includes("adq-soc.click") || host.startsWith("admin.");

  if (isAdminDomain) {
    // Trả về thẳng giao diện Admin Console trên domain adq-soc.click
    return <AdminDashboardPage />;
  }

  return <LandingPage />;
}

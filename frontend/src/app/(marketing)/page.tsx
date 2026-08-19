import { headers } from "next/headers";
import { LandingPage } from "@/components/landing-page";
import AdminLoginPage from "@/app/admin/login/page";

export default async function HomePage() {
  const headersList = await headers();
  const host = (headersList.get("x-forwarded-host") || headersList.get("host") || "").toLowerCase();

  // Nếu truy cập từ domain SOC Admin, hiển thị cổng đăng nhập SOC biệt lập
  if (host.includes("adq-soc.click") || host.startsWith("admin.")) {
    return <AdminLoginPage />;
  }

  // Mặc định cho domain chính của người dùng
  return <LandingPage />;
}

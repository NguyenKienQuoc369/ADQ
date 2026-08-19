import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export default function LoginPage() {
  return (
    <AuthShell
      title="Đăng Nhập SOC Console"
      subtitle="Truy cập không gian làm việc bảo mật và điều phối quét DAST"
      footerText="Chưa có tài khoản?"
      footerLinkText="Đăng ký tài khoản mới"
      footerLinkHref="/register"
    >
      <LoginForm />
    </AuthShell>
  );
}

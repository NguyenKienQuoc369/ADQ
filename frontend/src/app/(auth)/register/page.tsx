import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Khởi Tạo Tài Khoản ADQ"
      subtitle="Trải nghiệm hệ thống quét bảo mật DAST và kiểm toán mã độc tự động"
      footerText="Đã có tài khoản?"
      footerLinkText="Đăng nhập ngay"
      footerLinkHref="/login"
    >
      <RegisterForm />
    </AuthShell>
  );
}

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Khôi Phục Mật Khẩu"
      subtitle="Nhập email để nhận liên kết thiết lập lại mật khẩu tài khoản"
      footerText="Nhớ mật khẩu?"
      footerLinkText="Quay lại đăng nhập"
      footerLinkHref="/login"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

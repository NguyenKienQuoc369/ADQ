import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Thiết Lập Mật Khẩu Mới"
      subtitle="Tạo mật khẩu mới có độ dài tối thiểu 8 ký tự để bảo vệ tài khoản"
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}

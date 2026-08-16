import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-300">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

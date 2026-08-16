import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/auth-forms";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-[var(--foreground-muted)]">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}

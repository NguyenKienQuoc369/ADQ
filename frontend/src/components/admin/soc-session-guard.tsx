"use client";

import React, { useEffect, useState } from "react";
import AdminLoginPage from "@/app/admin/login/page";

export function SocSessionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authorized, setAuthorized] =
    useState<boolean | null>(null);

  const verify = async () => {
    try {
      const response = await fetch(
        "/api/admin/auth/session",
        {
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      setAuthorized(response.ok);

    } catch {
      setAuthorized(false);
    }
  };

  useEffect(() => {
    void verify();
  }, []);

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#020617]" />
    );
  }

  if (!authorized) {
    return (
      <AdminLoginPage
        onSuccess={() => {
          setAuthorized(true);
        }}
      />
    );
  }

  return <>{children}</>;
}

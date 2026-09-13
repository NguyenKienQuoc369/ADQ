"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminOperationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/services");
  }, [router]);

  return <div className="min-h-screen bg-[#000000]" />;
}

"use client";

import React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { RedeemCodesClient } from "@/components/admin/redeem-codes-client";
import { SocSessionGuard } from "@/components/admin/soc-session-guard";

export default function AdminRedeemCodesPage() {
  return (
    <SocSessionGuard>
      <AdminShell>
        <div className="mx-auto max-w-7xl">
          <RedeemCodesClient />
        </div>
      </AdminShell>
    </SocSessionGuard>
  );
}

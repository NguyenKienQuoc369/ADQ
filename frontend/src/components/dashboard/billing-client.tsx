"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPackagePlans, redeemCode } from "@/lib/api";
import { formatDateTime, getPackageGlow } from "@/lib/utils";

const redeemSchema = z.object({
  code: z.string().min(4, "Vui lòng nhập redeem code hợp lệ."),
});

export function BillingClient() {
  const { user, updateUser } = useAuth();
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getPackagePlans>>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const form = useForm<z.infer<typeof redeemSchema>>({
    resolver: zodResolver(redeemSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    getPackagePlans().then(setPlans);
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const nextUser = await redeemCode(values.code);
      updateUser(nextUser);
      setMessage({ type: "success", text: `Redeem thành công. Gói của bạn đã được nâng cấp lên ${nextUser.packageTier.replace("_", " ")}.` });
      form.reset();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể kích hoạt redeem code.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Quản lý gói cước</CardTitle>
              <CardDescription>So sánh quyền lợi Free, Pro, Pro Max và theo dõi trạng thái thuê bao hiện tại.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => {
                const active = user?.packageTier === plan.tier;

                return (
                  <div
                    key={plan.tier}
                    className={`rounded-3xl border p-5 ${
                      active ? "border-cyan-500/30 bg-slate-950/90" : "border-slate-800 bg-slate-900/70"
                    }`}
                  >
                    <div className={`rounded-2xl bg-gradient-to-br p-4 ${getPackageGlow(plan.tier)}`}>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-xl font-semibold text-slate-50">{plan.name}</p>
                        {active ? <Badge variant="success">Đang dùng</Badge> : <Badge variant="muted">Available</Badge>}
                      </div>
                      <p className="text-2xl font-semibold text-slate-50">{plan.priceLabel}</p>
                    </div>
                    <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      Đang cập nhật
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-400">{plan.description}</p>
                    <div className="mt-4 space-y-2">
                      {plan.features.map((feature) => (
                        <div key={feature} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gói đang hoạt động</CardTitle>
                <CardDescription>Tóm tắt quyền hiện có và thời hạn hiệu lực của tài khoản.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/12 via-emerald-500/10 to-slate-950 p-5">
                  <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Current Package</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-50">{user?.packageTier.replace("_", " ")}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="success">{user?.role}</Badge>
                    <Badge variant="default">{user?.status}</Badge>
                  </div>
                </div>
                <InfoRow label="Lượt quét hôm nay" value={`${user?.scansToday ?? 0} / ${user?.dailyLimit ?? 0}`} />
                <InfoRow label="Hạn gói" value={user?.planExpiresAt ? formatDateTime(user.planExpiresAt) : "Vĩnh viễn / chưa giới hạn"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Redeem Code</CardTitle>
              </CardHeader>
              <CardContent>
                {message ? (
                  <div
                    className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                      message.type === "error"
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    {message.text}
                  </div>
                ) : null}

                <form className="space-y-4" onSubmit={onSubmit}>
                  <div>
                    <Label htmlFor="redeem-code">Mã redeem</Label>
                    <Input id="redeem-code" className="mt-2" placeholder="PRO-30D-NEON" {...form.register("code")} />
                    {form.formState.errors.code ? (
                      <p className="mt-2 text-xs text-rose-300">{form.formState.errors.code.message}</p>
                    ) : null}
                  </div>

                  <Button className="w-full" type="submit" disabled={submitting}>
                    {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                    Kích hoạt mã
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
}


"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, LoaderCircle, TicketPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createRedeemCode, getRedeemCodes } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const redeemGeneratorSchema = z.object({
  packageTier: z.enum(["PRO", "PRO_MAX"]),
  durationLabel: z.string().min(2, "Vui lòng nhập thời hạn sử dụng."),
  maxUses: z.number().int().min(1, "Số lần sử dụng tối thiểu là 1."),
});

export function RedeemCodesClient() {
  const [codes, setCodes] = useState<Awaited<ReturnType<typeof getRedeemCodes>>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const form = useForm<z.infer<typeof redeemGeneratorSchema>>({
    resolver: zodResolver(redeemGeneratorSchema),
    defaultValues: {
      packageTier: "PRO",
      durationLabel: "30 ngày",
      maxUses: 20,
    },
  });

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRedeemCodes();
      setCodes(response);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCodes();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCodes]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const code = await createRedeemCode(values);
      setMessage({ type: "success", text: `Đã tạo mã ${code.code} cho gói ${code.packageTier.replace("_", " ")}.` });
      form.reset({ packageTier: values.packageTier, durationLabel: values.durationLabel, maxUses: values.maxUses });
      await loadCodes();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tạo redeem code.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <DashboardShell area="admin">
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Redeem Code Generator</CardTitle>
            <CardDescription>Tạo mã nâng cấp Pro hoặc Pro Max với thời hạn và giới hạn sử dụng tùy chỉnh.</CardDescription>
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
                <Label htmlFor="code-package">Loại gói</Label>
                <Select id="code-package" className="mt-2" {...form.register("packageTier")}>
                  <option value="PRO">PRO</option>
                  <option value="PRO_MAX">PRO MAX</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="duration-label">Thời hạn sử dụng</Label>
                <Input id="duration-label" className="mt-2" placeholder="30 ngày / Vĩnh viễn" {...form.register("durationLabel")} />
                {form.formState.errors.durationLabel ? (
                  <p className="mt-2 text-xs text-rose-300">{form.formState.errors.durationLabel.message}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="max-uses">Số lần sử dụng tối đa</Label>
                <Input id="max-uses" className="mt-2" type="number" min={1} {...form.register("maxUses", { valueAsNumber: true })} />
                {form.formState.errors.maxUses ? (
                  <p className="mt-2 text-xs text-rose-300">{form.formState.errors.maxUses.message}</p>
                ) : null}
              </div>

              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TicketPlus className="h-4 w-4" />}
                Tạo mã mới
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách mã đã tạo</CardTitle>
            <CardDescription>Kiểm soát trạng thái chưa dùng, đã dùng một phần hoặc đã dùng hết.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-3xl border border-slate-800 bg-slate-900/60" />)
            ) : (
              codes.map((code) => (
                <div key={code.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-cyan-300" />
                        <p className="font-mono text-sm font-semibold text-slate-100">{code.code}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">Tạo lúc {formatDateTime(code.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">{code.packageTier.replace("_", " ")}</Badge>
                      <Badge variant={code.status === "USED" ? "danger" : code.status === "PARTIAL" ? "warning" : "success"}>
                        {code.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoRow label="Thời hạn" value={code.durationLabel} />
                    <InfoRow label="Lượt dùng" value={`${code.usedCount} / ${code.maxUses}`} />
                    <InfoRow label="Kích hoạt bởi" value={code.activatedBy ?? "Chưa có"} />
                  </div>
                </div>
              ))
            )}

            {!loading && codes.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">Chưa có redeem code nào được tạo.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

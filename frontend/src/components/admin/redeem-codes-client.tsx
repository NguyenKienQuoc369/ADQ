"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, LoaderCircle, TicketPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr] font-sans text-[#ededed]">
      <div className="rounded-lg border border-[#222222] bg-[#000000] p-6">
        <div className="mb-4 border-b border-[#222222] pb-3">
          <h2 className="text-base font-semibold text-white">Redeem Code Generator</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Tạo mã nâng cấp Pro hoặc Pro Max với thời hạn và giới hạn sử dụng tùy chỉnh.</p>
        </div>

        {message ? (
          <div
            className={`mb-4 rounded-md border px-3.5 py-2.5 text-xs ${
              message.type === "error"
                ? "border-rose-500/30 bg-rose-950/20 text-rose-300"
                : "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="code-package" className="text-[11px] font-mono uppercase text-neutral-400">Loại gói</Label>
            <Select id="code-package" className="mt-1.5 h-9 bg-[#0a0a0a] border-[#333333] text-white text-xs rounded-md" {...form.register("packageTier")}>
              <option value="PRO">PRO</option>
              <option value="PRO_MAX">PRO MAX</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="duration-label" className="text-[11px] font-mono uppercase text-neutral-400">Thời hạn sử dụng</Label>
            <Input id="duration-label" className="mt-1.5 h-9 bg-[#0a0a0a] border-[#333333] text-white text-xs rounded-md" placeholder="30 ngày / Vĩnh viễn" {...form.register("durationLabel")} />
            {form.formState.errors.durationLabel ? (
              <p className="mt-1 text-xs text-rose-400">{form.formState.errors.durationLabel.message}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="max-uses" className="text-[11px] font-mono uppercase text-neutral-400">Số lần sử dụng tối đa</Label>
            <Input id="max-uses" className="mt-1.5 h-9 bg-[#0a0a0a] border-[#333333] text-white text-xs rounded-md" type="number" min={1} {...form.register("maxUses", { valueAsNumber: true })} />
            {form.formState.errors.maxUses ? (
              <p className="mt-1 text-xs text-rose-400">{form.formState.errors.maxUses.message}</p>
            ) : null}
          </div>

          <Button className="w-full h-9 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <TicketPlus className="h-3.5 w-3.5 mr-1.5" />}
            Tạo mã mới
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-[#222222] bg-[#000000] p-6">
        <div className="mb-4 border-b border-[#222222] pb-3">
          <h2 className="text-base font-semibold text-white">Danh sách mã đã tạo</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Kiểm soát trạng thái chưa dùng, đã dùng một phần hoặc đã dùng hết.</p>
        </div>

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 rounded-lg border border-[#222222] bg-[#0a0a0a]" />)
          ) : (
            codes.map((code) => (
              <div key={code.id} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-white" />
                      <p className="font-mono text-xs font-semibold text-white">{code.code}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500 font-mono">Tạo lúc {formatDateTime(code.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="border border-neutral-700 bg-neutral-800 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">
                      {code.packageTier.replace("_", " ")}
                    </span>
                    <span className="border border-neutral-700 bg-neutral-800 text-neutral-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
                      {code.status}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                  <InfoRow label="Thời hạn" value={code.durationLabel} />
                  <InfoRow label="Lượt dùng" value={`${code.usedCount} / ${code.maxUses}`} />
                  <InfoRow label="Kích hoạt bởi" value={code.activatedBy ?? "Chưa có"} />
                </div>
              </div>
            ))
          )}

          {!loading && codes.length === 0 ? (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-6 text-xs text-neutral-500 text-center font-mono">Chưa có redeem code nào được tạo.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#222222] bg-[#000000] px-3 py-2">
      <p className="text-[10px] uppercase font-mono text-neutral-500">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-white truncate">{value}</p>
    </div>
  );
}

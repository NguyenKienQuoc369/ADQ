"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModuleFrame({
  icon: Icon,
  eyebrow,
  title,
  description,
  stats,
  links,
  beginnerTitle,
  beginnerText,
  nextSteps,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  stats: Array<{ label: string; value: string; variant?: "default" | "success" | "warning" | "danger" | "muted" }>;
  links?: Array<{ href: string; label: string }>;
  beginnerTitle?: string;
  beginnerText?: string;
  nextSteps?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-cyan-500/10">
        <CardContent className="p-0">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">{eyebrow}</p>
              <div className="mt-3 flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-cyan-500/25 bg-cyan-500/10">
                  <Icon className="h-6 w-6 text-cyan-300" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold text-slate-50">{title}</h2>
                  <p className="max-w-3xl text-sm leading-7 text-slate-400">{description}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Dành cho người mới</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {beginnerText ?? "Bạn không cần hiểu thuật ngữ kỹ thuật. Chỉ cần đọc các gợi ý trên màn hình và làm theo từng bước."}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-100">{beginnerTitle ?? "Bạn nên làm gì ở màn này?"}</p>
                <div className="mt-3 grid gap-2">
                  {(links ?? []).map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-900"
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    </Link>
                  ))}
                </div>
              </div>

              {nextSteps?.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-sm font-medium text-slate-100">Bước tiếp theo</p>
                  <div className="mt-3 space-y-2">
                    {nextSteps.map((step) => (
                      <div key={step} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-800/70 bg-slate-950/60 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-slate-100">{item.value}</p>
                  <Badge variant={item.variant ?? "muted"}>{item.label}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {children}
    </div>
  );
}

export function ModuleSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Bug, Network, ShieldAlert, Terminal } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const advancedTools = [
  {
    href: "/c2",
    title: "Điều phối quét nâng cao",
    description: "Dùng khi bạn muốn đẩy nhiều mục tiêu, chọn profile quét và theo dõi worker theo thời gian thực.",
    icon: Terminal,
    badge: "Điều phối",
  },
  {
    href: "/ctem",
    title: "Bản đồ tài sản website",
    description: "Xem domain, subdomain, cổng mở và endpoint theo cấu trúc dễ theo dõi hơn.",
    icon: ShieldAlert,
    badge: "Tài sản",
  },
  {
    href: "/graph",
    title: "Sơ đồ liên kết rủi ro",
    description: "Phù hợp khi cần lần theo đường đi của rủi ro từ một điểm yếu sang nhiều thành phần khác.",
    icon: Network,
    badge: "Phân tích",
  },
  {
    href: "/vulnerabilities",
    title: "Chi tiết cảnh báo kỹ thuật",
    description: "Nơi đọc bằng chứng kỹ thuật, raw request/response và xử lý các cảnh báo chuyên sâu.",
    icon: Bug,
    badge: "Cảnh báo",
  },
];

export default function DashboardToolsPage() {
  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Công cụ nâng cao</CardTitle>
            <CardDescription>
              Mình đã gom các màn chuyên sâu về chung một nơi để sidebar gọn hơn. Nếu bạn chỉ cần thao tác cơ bản, cứ ở
              `Trang tổng quan`.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          {advancedTools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link key={tool.href} href={tool.href} className="group">
                <Card className="h-full transition hover:-translate-y-0.5">
                  <CardContent className="flex h-full flex-col gap-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color:var(--accent-soft)]">
                        <Icon className="h-5 w-5 text-[color:var(--accent-strong)]" />
                      </div>
                      <Badge variant="muted">{tool.badge}</Badge>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-[var(--foreground)]">{tool.title}</h3>
                      <p className="text-sm leading-6 text-[var(--foreground-muted)]">{tool.description}</p>
                    </div>

                    <div className="mt-auto flex items-center gap-2 text-sm font-medium text-[color:var(--accent-strong)]">
                      <span>Mở công cụ</span>
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}

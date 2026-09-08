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
      <div className="space-y-6 font-sans text-[#ededed]">
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-6">
          <h1 className="text-xl font-semibold text-white">Công cụ nâng cao</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Tổng hợp các mô-đun chuyên sâu về bảo mật và phân tích hạ tầng tập trung.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {advancedTools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link key={tool.href} href={tool.href} className="group">
                <div className="h-full rounded-lg border border-[#222222] bg-[#000000] p-6 hover:border-neutral-700 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#333333] bg-[#0a0a0a]">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="border border-neutral-700 bg-neutral-800 text-neutral-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
                        {tool.badge}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white group-hover:text-white transition">{tool.title}</h3>
                    <p className="text-xs leading-relaxed text-neutral-400 mt-1">{tool.description}</p>
                  </div>

                  <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-white">
                    <span>Mở công cụ</span>
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}

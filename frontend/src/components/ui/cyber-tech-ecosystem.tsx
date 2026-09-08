"use client";

import React from "react";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { Cpu, Layers, Server, Terminal, Workflow } from "lucide-react";

const integrations = [
  { name: "Amazon Web Services", category: "Cloud Provider", icon: Server },
  { name: "Cloudflare WAF & CDN", category: "Edge Defense", icon: Layers },
  { name: "Docker Container", category: "Infrastructure", icon: Cpu },
  { name: "Kubernetes Orchestrator", category: "Cluster Security", icon: Workflow },
  { name: "GitHub Actions / CI", category: "DevSecOps", icon: Terminal },
  { name: "GitLab CI/CD Pipeline", category: "DevSecOps", icon: Workflow },
];

export function CyberTechEcosystem() {
  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono font-bold">
          [TƯƠNG THÍCH HẠ TẦNG DỄ DÀNG]
        </p>
        <h3 className="text-2xl md:text-3xl font-extrabold text-white">
          Tích hợp liền mạch với hệ sinh thái của bạn
        </h3>
        <p className="text-sm text-slate-300">
          Tự động kết nối với đám mây, cụm máy chủ và quy trình DevSecOps mà không làm gián đoạn hệ thống.
        </p>
      </div>

      <LiquidGlassCard className="p-6 md:p-8 border-cyan-500/20">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {integrations.map((item, idx) => {
            const Icon = item.icon;

            return (
              <div
                key={idx}
                className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-white/10 bg-slate-950/40 hover:border-cyan-400/50 hover:bg-slate-900/60 transition-all duration-300 group"
              >
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform mb-2.5">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-white group-hover:text-cyan-200 transition-colors">
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {item.category}
                </p>
              </div>
            );
          })}
        </div>
      </LiquidGlassCard>
    </div>
  );
}


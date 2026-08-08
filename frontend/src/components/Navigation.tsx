"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Terminal, 
  ShieldAlert, 
  Network, 
  Bug, 
  Cpu, 
  Activity,
  Radio
} from "lucide-react";
import { useState, useEffect } from "react";

export function Navigation() {
  const pathname = usePathname();
  const [stats, setStats] = useState({
    activeWorkers: 4,
    runningJobs: 2,
    oastCallbacks: 12,
    criticalVulns: 3
  });

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate live heartbeats
      setStats(prev => ({
        ...prev,
        oastCallbacks: prev.oastCallbacks + (Math.random() > 0.7 ? 1 : 0)
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: "/c2", label: "C2 & Task Dispatcher", icon: Terminal },
    { href: "/ctem", label: "Attack Surface Matrix", icon: ShieldAlert },
    { href: "/graph", label: "Knowledge Graph", icon: Network },
    { href: "/vulnerabilities", label: "Vulnerabilities & OAST Inbox", icon: Bug },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 text-zinc-100 sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/20 border border-red-500/40 text-red-500">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-lg font-bold tracking-wider text-white">ADQ</span>
              <span className="rounded bg-red-950 px-1.5 py-0.5 font-mono text-[10px] font-medium text-red-400 border border-red-800">
                ENTERPRISE DAST/ASM
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">Master Grid C2 Console v2.0</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 font-mono text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/c2" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2 rounded-md px-3 py-2 transition-all ${
                  isActive
                    ? "bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-red-400" : "text-zinc-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Live System Stat Badges */}
        <div className="hidden lg:flex items-center space-x-3 font-mono text-xs">
          <div className="flex items-center space-x-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-zinc-300">
            <Cpu className="h-3.5 w-3.5 text-emerald-400" />
            <span>Workers:</span>
            <span className="font-bold text-emerald-400">{stats.activeWorkers} Online</span>
          </div>

          <div className="flex items-center space-x-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-zinc-300">
            <Activity className="h-3.5 w-3.5 text-amber-400" />
            <span>Jobs:</span>
            <span className="font-bold text-amber-400">{stats.runningJobs} Active</span>
          </div>

          <div className="flex items-center space-x-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-zinc-300">
            <Radio className="h-3.5 w-3.5 text-blue-400" />
            <span>OAST:</span>
            <span className="font-bold text-blue-400">{stats.oastCallbacks} Pings</span>
          </div>

          <div className="flex items-center space-x-1.5 rounded-full bg-red-950/60 border border-red-800/80 px-2.5 py-1 text-red-300">
            <Bug className="h-3.5 w-3.5 text-red-400" />
            <span>Critical:</span>
            <span className="font-bold text-red-400">{stats.criticalVulns} Vulns</span>
          </div>
        </div>
      </div>
    </header>
  );
}

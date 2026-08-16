import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function getSeverityColor(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "text-rose-300 bg-rose-500/10 border-rose-500/30";
    case "HIGH":
      return "text-orange-300 bg-orange-500/10 border-orange-500/30";
    case "MEDIUM":
      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    default:
      return "text-cyan-300 bg-cyan-500/10 border-cyan-500/30";
  }
}

export function getPackageGlow(packageName: string) {
  switch (packageName) {
    case "PRO_MAX":
      return "from-cyan-500/25 via-emerald-500/15 to-slate-950";
    case "PRO":
      return "from-emerald-500/20 via-cyan-500/10 to-slate-950";
    default:
      return "from-slate-700/20 via-slate-800/20 to-slate-950";
  }
}

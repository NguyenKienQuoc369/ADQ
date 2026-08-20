import type { PackageTier } from "@/lib/api";

export type EntitlementPolicy = {
  scanLifetimeLimit: number | null;
  aiScanAnalysis: boolean;
  stressDailyLimit: number;
  copilotChat: boolean;
  oneClickPatch: boolean;
  apkAudit: boolean;
  exportFormats: Array<"markdown" | "json" | "html">;
};

export const ENTITLEMENTS: Record<PackageTier, EntitlementPolicy> = {
  FREE: {
    scanLifetimeLimit: 2,
    aiScanAnalysis: false,
    stressDailyLimit: 0,
    copilotChat: false,
    oneClickPatch: false,
    apkAudit: false,
    exportFormats: ["markdown"],
  },

  PRO: {
    scanLifetimeLimit: null,
    aiScanAnalysis: true,
    stressDailyLimit: 1,
    copilotChat: false,
    oneClickPatch: false,
    apkAudit: false,
    exportFormats: ["markdown", "json", "html"],
  },

  PRO_MAX: {
    scanLifetimeLimit: null,
    aiScanAnalysis: true,
    stressDailyLimit: 10,
    copilotChat: true,
    oneClickPatch: true,
    apkAudit: true,
    exportFormats: ["markdown", "json", "html"],
  },
};

export function getEntitlements(
  tier?: PackageTier | string | null
): EntitlementPolicy {
  const normalized =
    tier === "PRO_MAX"
      ? "PRO_MAX"
      : tier === "PRO"
        ? "PRO"
        : "FREE";

  return ENTITLEMENTS[normalized];
}

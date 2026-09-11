/**
 * Route classifier determining if a given API path belongs to the FastAPI backend (api.adq.io.vn)
 * or the Next.js same-origin frontend server (adq.io.vn).
 */
export function isFastApiBackendRoute(path: string): boolean {
  if (!path) return false;
  const cleanPath = path.split("?")[0];

  const isMatch = (prefix: string) =>
    cleanPath === prefix || cleanPath.startsWith(prefix + "/");

  // Explicit FastAPI namespaces:
  // - /api/health
  // - /api/scan, /api/scan/* (NOT /api/scans or /api/scans/*)
  // - /api/copilot, /api/copilot/*
  // - /api/stress, /api/stress/*
  // - /api/verification, /api/verification/*
  // - /api/c2, /api/c2/*
  // - /api/oast, /api/oast/*
  // - /api/apk-audit, /api/apk-audit/*
  if (
    cleanPath === "/api/health" ||
    isMatch("/api/scan") ||
    isMatch("/api/copilot") ||
    isMatch("/api/stress") ||
    isMatch("/api/verification") ||
    isMatch("/api/c2") ||
    isMatch("/api/oast") ||
    isMatch("/api/apk-audit")
  ) {
    return true;
  }

  return false;
}

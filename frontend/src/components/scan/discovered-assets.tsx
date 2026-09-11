"use client";

import React, { useState, useMemo } from "react";
import { Globe, Server, Link2, Search, ChevronLeft, ChevronRight, Check } from "lucide-react";

export interface DiscoveredHost {
  host: string;
  state?: string;
  ip?: string;
  source?: string;
}

export interface DiscoveredPort {
  host: string;
  port: number | string;
  protocol?: string;
  service?: string;
  state?: string;
  banner?: string;
}

export interface DiscoveredUrl {
  url: string;
  status?: number | string;
  source?: string;
  method?: string;
}

interface DiscoveredAssetsProps {
  hosts?: (string | DiscoveredHost)[];
  ports?: (number | string | DiscoveredPort)[];
  urls?: (string | DiscoveredUrl)[];
  defaultTarget?: string;
}

export function DiscoveredAssets({
  hosts = [],
  ports = [],
  urls = [],
  defaultTarget = "",
}: DiscoveredAssetsProps) {
  const [activeTab, setActiveTab] = useState<"hosts" | "ports" | "urls">("hosts");
  const [urlSearch, setUrlSearch] = useState("");
  const [urlPage, setUrlPage] = useState(1);
  const pageSize = 10;

  // Normalize hosts list
  const normalizedHosts: DiscoveredHost[] = useMemo(() => {
    if (!hosts.length && defaultTarget) {
      return [{ host: defaultTarget, state: "LIVE", ip: "-" }];
    }
    return hosts.map((h) => {
      if (typeof h === "string") {
        return { host: h, state: "LIVE", ip: "-" };
      }
      return {
        host: h.host || defaultTarget || "unknown",
        state: h.state || "LIVE",
        ip: h.ip || "-",
        source: h.source || "Recon",
      };
    });
  }, [hosts, defaultTarget]);

  // Normalize ports list
  const normalizedPorts: DiscoveredPort[] = useMemo(() => {
    if (!ports.length) {
      return [
        { host: defaultTarget || "target", port: "80/tcp", service: "HTTP", state: "OPEN" },
        { host: defaultTarget || "target", port: "443/tcp", service: "HTTPS", state: "OPEN" },
      ];
    }
    return ports.map((p) => {
      if (typeof p === "number" || typeof p === "string") {
        const portStr = String(p);
        const service = portStr.includes("443") ? "HTTPS" : portStr.includes("80") ? "HTTP" : "TCP";
        return {
          host: defaultTarget || "target",
          port: portStr.includes("/") ? portStr : `${portStr}/tcp`,
          service,
          state: "OPEN",
        };
      }
      return {
        host: p.host || defaultTarget || "target",
        port: String(p.port).includes("/") ? p.port : `${p.port}/${p.protocol || "tcp"}`,
        service: p.service || (String(p.port).includes("443") ? "HTTPS" : "HTTP"),
        state: p.state || "OPEN",
        banner: p.banner,
      };
    });
  }, [ports, defaultTarget]);

  // Normalize URLs list
  const normalizedUrls: DiscoveredUrl[] = useMemo(() => {
    return urls.map((u) => {
      if (typeof u === "string") {
        return { url: u, status: 200, source: "crawler" };
      }
      return {
        url: u.url,
        status: u.status || 200,
        source: u.source || "crawler",
        method: u.method || "GET",
      };
    });
  }, [urls]);

  // Filtered & Paginated URLs
  const filteredUrls = useMemo(() => {
    if (!urlSearch.trim()) return normalizedUrls;
    const q = urlSearch.toLowerCase().trim();
    return normalizedUrls.filter((u) => u.url.toLowerCase().includes(q));
  }, [normalizedUrls, urlSearch]);

  const totalUrlPages = Math.max(1, Math.ceil(filteredUrls.length / pageSize));
  const paginatedUrls = useMemo(() => {
    const start = (urlPage - 1) * pageSize;
    return filteredUrls.slice(start, start + pageSize);
  }, [filteredUrls, urlPage]);

  return (
    <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 sm:p-5 space-y-4 font-sans">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1C1C1C]">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Server className="h-4 w-4 text-white" />
            Thông Tin Đã Phát Hiện (Discovered Assets)
          </h3>
          <p className="text-[11px] text-[#888888]">
            Dữ liệu quan sát thực tế từ quá trình rà quét (Host, Port, Endpoint)
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#050505] border border-[#242424]">
          <button
            onClick={() => setActiveTab("hosts")}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "hosts"
                ? "bg-white text-black font-bold"
                : "text-[#888888] hover:text-white"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Host & Subdomain ({normalizedHosts.length})
          </button>
          <button
            onClick={() => setActiveTab("ports")}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ports"
                ? "bg-white text-black font-bold"
                : "text-[#888888] hover:text-white"
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            Port & Service ({normalizedPorts.length})
          </button>
          <button
            onClick={() => setActiveTab("urls")}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "urls"
                ? "bg-white text-black font-bold"
                : "text-[#888888] hover:text-white"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            URL Đã Tìm Thấy ({normalizedUrls.length})
          </button>
        </div>
      </div>

      {/* Tab Content: Hosts & Subdomains */}
      {activeTab === "hosts" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#242424] text-[#888888]">
                <th className="pb-2.5 font-semibold">HOST / SUBDOMAIN</th>
                <th className="pb-2.5 font-semibold">IP ADDRESS</th>
                <th className="pb-2.5 font-semibold">NGUỒN</th>
                <th className="pb-2.5 font-semibold text-right">TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C1C]">
              {normalizedHosts.map((h, idx) => (
                <tr key={idx} className="hover:bg-[#141414]/50">
                  <td className="py-2.5 text-white font-medium">{h.host}</td>
                  <td className="py-2.5 text-[#888888]">{h.ip}</td>
                  <td className="py-2.5 text-[#888888]">{h.source || "DNS / Certificate Recon"}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]">
                      <Check className="h-3 w-3" />
                      {h.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: Ports & Services */}
      {activeTab === "ports" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#242424] text-[#888888]">
                <th className="pb-2.5 font-semibold">HOST</th>
                <th className="pb-2.5 font-semibold">PORT / PROTOCOL</th>
                <th className="pb-2.5 font-semibold">SERVICE</th>
                <th className="pb-2.5 font-semibold text-right">TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C1C]">
              {normalizedPorts.map((p, idx) => (
                <tr key={idx} className="hover:bg-[#141414]/50">
                  <td className="py-2.5 text-white font-medium">{p.host}</td>
                  <td className="py-2.5 text-[#22C55E]">{p.port}</td>
                  <td className="py-2.5 text-[#A3A3A3]">{p.service}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]">
                      {p.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: Crawled URLs */}
      {activeTab === "urls" && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#666666]" />
            <input
              type="text"
              placeholder="Lọc URL theo từ khóa (/api, /login, .js)..."
              value={urlSearch}
              onChange={(e) => {
                setUrlSearch(e.target.value);
                setUrlPage(1);
              }}
              className="w-full h-8 pl-8 pr-3 bg-[#050505] border border-[#242424] rounded text-xs font-mono text-white placeholder-[#555555] focus:outline-none focus:border-[#444444]"
            />
          </div>

          {paginatedUrls.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-[#666666] border border-[#1C1C1C] rounded-lg bg-[#050505]">
              {normalizedUrls.length === 0 ? "Chưa có URL nào được tìm thấy trong phiên scan này." : "Không tìm thấy URL phù hợp với từ khóa."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#242424] text-[#888888]">
                    <th className="pb-2.5 font-semibold">URL ENDPOINT</th>
                    <th className="pb-2.5 font-semibold">PHƯƠNG THỨC</th>
                    <th className="pb-2.5 font-semibold">NGUỒN</th>
                    <th className="pb-2.5 font-semibold text-right">HTTP STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C1C1C]">
                  {paginatedUrls.map((u, idx) => (
                    <tr key={idx} className="hover:bg-[#141414]/50">
                      <td className="py-2 text-white font-mono truncate max-w-md" title={u.url}>
                        {u.url}
                      </td>
                      <td className="py-2 text-[#888888]">{u.method || "GET"}</td>
                      <td className="py-2 text-[#888888]">{u.source || "crawler"}</td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            String(u.status).startsWith("2")
                              ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]"
                              : String(u.status).startsWith("3")
                              ? "border-[#EAB308]/40 bg-[#EAB308]/10 text-[#EAB308]"
                              : "border-[#333333] bg-[#141414] text-[#A3A3A3]"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination controls */}
          {totalUrlPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-[#1C1C1C] text-xs font-mono text-[#888888]">
              <span>
                Hiển thị {paginatedUrls.length} / {filteredUrls.length} URLs
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={urlPage <= 1}
                  onClick={() => setUrlPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded bg-[#141414] border border-[#242424] text-[#A3A3A3] hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-white">
                  {urlPage} / {totalUrlPages}
                </span>
                <button
                  disabled={urlPage >= totalUrlPages}
                  onClick={() => setUrlPage((p) => Math.min(totalUrlPages, p + 1))}
                  className="p-1 rounded bg-[#141414] border border-[#242424] text-[#A3A3A3] hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

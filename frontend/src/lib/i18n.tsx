"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type LanguageCode = "en" | "vi";

type Dictionary = Record<string, string>;

const dictionaries: Record<LanguageCode, Dictionary> = {
  en: {
    // Navigation
    "nav.c2": "C2 & Task Dispatcher",
    "nav.ctem": "Attack Surface Matrix",
    "nav.graph": "Knowledge Graph",
    "nav.vuln": "Vulnerabilities & OAST Inbox",
    "nav.console": "Master Grid C2 Console v2.0",
    "nav.workers": "Workers",
    "nav.jobs": "Jobs",
    "nav.oast": "OAST",
    "nav.critical": "Critical",
    "nav.online": "Online",
    "nav.active": "Active",
    "nav.pings": "Pings",
    "nav.vulns": "Vulns",
    "lang.label": "Language",
    "lang.en": "English",
    "lang.vi": "Tiếng Việt",

    // Guide
    "guide.title": "How to use",
    "guide.step1": "Choose language in the top-right switcher.",
    "guide.step2": "Go to C2 and paste one target per line.",
    "guide.step3": "Select profiles and click Launch Enterprise Scan.",
    "guide.step4": "Monitor worker status and OAST callbacks in real-time.",

    // C2 Page
    "c2.title": "C2 Command & Task Dispatcher",
    "c2.subtitle": "Dispatch targets to Master Grid Node and monitor real-time worker capabilities.",
    "c2.refresh": "Refresh Grid",
    "c2.targetIngestion": "Target Ingestion & Dispatcher",
    "c2.bulkReady": "BULK READY",
    "c2.scopeLabel": "Target Scope (Domains / IPs - 1 per line):",
    "c2.uploadTxt": "Upload .txt",
    "c2.selectProfiles": "Select Scan Profiles:",
    "c2.profile.recon": "Recon Infra",
    "c2.profile.reconDesc": "Subdomains, DNS, Ports [Low Noise]",
    "c2.profile.web": "Web Mapping",
    "c2.profile.webDesc": "HTTP, Deep JS, Tech Stack [Light]",
    "c2.profile.dast": "Active DAST",
    "c2.profile.dastDesc": "Nuclei CVEs, FFuf Fuzzing [Active]",
    "c2.profile.logic": "Deep Logic Scan",
    "c2.profile.logicDesc": "Race, IDOR, Token Swap [Heavy]",
    "c2.nodeCapability": "Node Capability Allocation:",
    "c2.cap.all": "All Worker Nodes (Parallel Mesh)",
    "c2.cap.light": "Light Workers Only (Passive Recon)",
    "c2.cap.elite": "Elite DAST Cluster (Heavy Exploitation)",
    "c2.priority": "Queue Priority Score:",
    "c2.launchBtn": "Launch Enterprise Scan",
    "c2.dispatching": "Dispatching Task...",
    "c2.gridStatus": "Live Grid Topology & Capacity",
    "c2.nodeStatus": "Node Capability & Status",
    "c2.cpu": "CPU",
    "c2.ram": "RAM",
    "c2.hb": "HB",

    // CTEM Page
    "ctem.title": "Continuous Threat Exposure Management (CTEM) - Attack Surface",
    "ctem.subtitle": "Tree matrix of assets, subdomains, open ports, services, and API endpoints.",
    "ctem.filterNewOnly": "Show New Assets Only (Delta)",
    "ctem.filterDroppedWaf": "Show Dropped WAF / High Risk",
    "ctem.rootDomains": "Root Domains Monitored",
    "ctem.subdomains": "Subdomains Discovered",
    "ctem.endpoints": "Endpoints Mapped",
    "ctem.fuzz": "Fuzz Logic",
    "ctem.subdomainCount": "subdomains",
    "ctem.port": "Port",

    // Graph Page
    "graph.title": "Security Knowledge Graph Explorer & Blast Radius",
    "graph.subtitle": "Traverse threat topology, secret leaks, and critical attack impact paths across graph nodes.",
    "graph.riskScore": "Topology Risk Score",
    "graph.fromLeak": "From Leaked Asset:",
    "graph.toTarget": "To Root Target:",
    "graph.queryPath": "Query Impact Path",
    "graph.legend": "Graph Node Types Legend",
    "graph.domain": "Domain",
    "graph.subdomain": "Subdomain",
    "graph.port": "Port / Service",
    "graph.endpoint": "API Endpoint",
    "graph.secret": "Leaked Secret / Token",
    "graph.nodeDetails": "Node Detail Drawer",
    "graph.nodeType": "Node Type",
    "graph.impactPath": "Impact Path Discovered",

    // Vulnerabilities Page
    "vuln.title": "Vulnerability Triage & OAST Correlation",
    "vuln.subtitle": "Correlate out-of-band callbacks with active DAST scan results.",
    "vuln.tabTriage": "Vulnerability Triage",
    "vuln.tabOast": "OAST Live Inbox",
    "vuln.exportMd": "Export Markdown Report",
    "vuln.exportJson": "Export JSON",
    "vuln.searchPlaceholder": "Search CVE, vulnerability title, host, or endpoint...",
    "vuln.allSeverity": "ALL SEVERITIES",
    "vuln.rawReq": "Raw HTTP Request",
    "vuln.rawRes": "Raw HTTP Response",
    "vuln.copyReq": "Copy Request",
    "vuln.copyRes": "Copy Response",
    "vuln.copied": "Copied!",
    "vuln.noVulnSelected": "Select a vulnerability to view technical details.",
    "vuln.oastStream": "Live OAST Pingbacks Stream",
  },
  vi: {
    // Navigation
    "nav.c2": "Điều Phối C2 & Tác Vụ",
    "nav.ctem": "Ma Trận Bề Mặt Tấn Công",
    "nav.graph": "Đồ Thị Tri Thức",
    "nav.vuln": "Lỗ Hổng & Hộp Thư OAST",
    "nav.console": "Bảng Điều Khiển Master Grid C2 v2.0",
    "nav.workers": "Worker",
    "nav.jobs": "Tác vụ",
    "nav.oast": "OAST",
    "nav.critical": "Nghiêm trọng",
    "nav.online": "Đang online",
    "nav.active": "Đang chạy",
    "nav.pings": "Lượt ping",
    "nav.vulns": "Lỗ hổng",
    "lang.label": "Ngôn ngữ",
    "lang.en": "English",
    "lang.vi": "Tiếng Việt",

    // Guide
    "guide.title": "Hướng dẫn sử dụng",
    "guide.step1": "Chọn ngôn ngữ ở bộ chọn góc phải trên cùng.",
    "guide.step2": "Vào màn C2 và dán mục tiêu, mỗi dòng một domain/IP.",
    "guide.step3": "Chọn profile quét rồi bấm Launch Enterprise Scan.",
    "guide.step4": "Theo dõi trạng thái worker và callback OAST theo thời gian thực.",

    // C2 Page
    "c2.title": "Bảng Điều Khiển C2 & Điều Phối Tác Vụ",
    "c2.subtitle": "Đẩy mục tiêu vào Master Grid Node và giám sát năng lực worker theo thời gian thực.",
    "c2.refresh": "Làm mới Grid",
    "c2.targetIngestion": "Thu Thập & Điều Phối Mục Tiêu",
    "c2.bulkReady": "HỖ TRỢ HÀNG LOẠT",
    "c2.scopeLabel": "Phạm vi mục tiêu (Domain / IP - 1 dòng 1 mục tiêu):",
    "c2.uploadTxt": "Tải file .txt",
    "c2.selectProfiles": "Chọn Profile Quét:",
    "c2.profile.recon": "Recon Hạ Tầng",
    "c2.profile.reconDesc": "Tên miền phụ, DNS, Mở Cổng [Độ ồn thấp]",
    "c2.profile.web": "Sơ Đồ Web",
    "c2.profile.webDesc": "HTTP, Phân tích JS, Công nghệ [Nhẹ]",
    "c2.profile.dast": "DAST Chủ Động",
    "c2.profile.dastDesc": "Quét Nuclei CVE, Fuzzing FFuf [Chủ động]",
    "c2.profile.logic": "Quét Logic Sâu",
    "c2.profile.logicDesc": "Race Condition, IDOR, Tráo Token [Nặng]",
    "c2.nodeCapability": "Phân Bổ Năng Lực Node Worker:",
    "c2.cap.all": "Tất cả các Node Worker (Lưới song song)",
    "c2.cap.light": "Chỉ Worker Hạng Nhẹ (Recon bị động)",
    "c2.cap.elite": "Cụm Elite DAST (Khai thác chuyên sâu)",
    "c2.priority": "Điểm Ưu Tiên Trong Hàng Đợi:",
    "c2.launchBtn": "Bắt Đầu Quét Doanh Nghiệp",
    "c2.dispatching": "Đang Điều Phối Tác Vụ...",
    "c2.gridStatus": "Sơ Đồ Lưới & Năng Lực Xử Lý",
    "c2.nodeStatus": "Năng Lực & Trạng Thái Node",
    "c2.cpu": "CPU",
    "c2.ram": "RAM",
    "c2.hb": "Nhịp tim",

    // CTEM Page
    "ctem.title": "Quản Lý Bề Mặt Tấn Công (CTEM) - Ma Trận Tài Sản",
    "ctem.subtitle": "Ma trận dạng cây hiển thị tài sản, tên miền phụ, cổng dịch vụ và endpoint API.",
    "ctem.filterNewOnly": "Chỉ Hiện Tài Sản Mới Mới Phát Hiện (Delta)",
    "ctem.filterDroppedWaf": "Chỉ Hiện Tài Sản Mất WAF / Rủi Ro Cao",
    "ctem.rootDomains": "Tên Miền Gốc Theo Dõi",
    "ctem.subdomains": "Tên Miền Phụ Tìm Thấy",
    "ctem.endpoints": "Endpoint Mapped",
    "ctem.fuzz": "Fuzz Logic",
    "ctem.subdomainCount": "tên miền phụ",
    "ctem.port": "Cổng",

    // Graph Page
    "graph.title": "Khám Phá Đồ Thị Tri Thức Bảo Mật & Bán Kính Ảnh Hưởng",
    "graph.subtitle": "Duyệt qua sơ đồ mối đe dọa, rò rỉ secret và chuỗi tấn công nguy hiểm trên các node đồ thị.",
    "graph.riskScore": "Điểm Rủi Ro Sơ Đồ",
    "graph.fromLeak": "Từ Tài Sản Rò Rỉ:",
    "graph.toTarget": "Đến Mục Tiêu Gốc:",
    "graph.queryPath": "Truy Truy Lập Chuỗi Tấn Công",
    "graph.legend": "Chú Giải Loại Node Đồ Thị",
    "graph.domain": "Tên Miền",
    "graph.subdomain": "Tên Miền Phụ",
    "graph.port": "Cổng / Dịch Vụ",
    "graph.endpoint": "Endpoint API",
    "graph.secret": "Rò Rỉ Secret / Token",
    "graph.nodeDetails": "Thông Tin Chi Tiết Node",
    "graph.nodeType": "Loại Node",
    "graph.impactPath": "Chuỗi Ảnh Hưởng Tìm Thấy",

    // Vulnerabilities Page
    "vuln.title": "Xử Lý Lỗ Hổng & Liên Kết OAST Callback",
    "vuln.subtitle": "Đối chiếu callback ngoài băng tần (Out-of-band) với kết quả quét DAST chủ động.",
    "vuln.tabTriage": "Danh Sách Lỗ Hổng",
    "vuln.tabOast": "Hộp Thư OAST Trực Tiếp",
    "vuln.exportMd": "Xuất Báo Cáo Markdown",
    "vuln.exportJson": "Xuất Báo Cáo JSON",
    "vuln.searchPlaceholder": "Tìm kiếm CVE, tên lỗ hổng, host hoặc endpoint...",
    "vuln.allSeverity": "TẤT CẢ MỨC ĐỘ",
    "vuln.rawReq": "HTTP Request Nguyên Bản",
    "vuln.rawRes": "HTTP Response Nguyên Bản",
    "vuln.copyReq": "Sao Chép Request",
    "vuln.copyRes": "Sao Chép Response",
    "vuln.copied": "Đã sao chép!",
    "vuln.noVulnSelected": "Chọn một lỗ hổng để xem chi tiết kỹ thuật.",
    "vuln.oastStream": "Luồng Pingback OAST Trực Tiếp",
  },
};

type I18nContextValue = {
  language: LanguageCode;
  setLanguage: (value: LanguageCode) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("adq_lang");
    if (saved === "en" || saved === "vi") {
      setLanguageState(saved);
      return;
    }

    const browserLang = window.navigator.language.toLowerCase();
    if (browserLang.startsWith("vi")) {
      setLanguageState("vi");
    }
  }, []);

  const setLanguage = (value: LanguageCode) => {
    setLanguageState(value);
    window.localStorage.setItem("adq_lang", value);
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[language] ?? dictionaries.en;
    return {
      language,
      setLanguage,
      t: (key: string) => dict[key] ?? dictionaries.en[key] ?? key,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLanguage() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

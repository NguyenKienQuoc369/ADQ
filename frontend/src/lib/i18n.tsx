"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type LanguageCode = "en" | "vi";

type Dictionary = Record<string, string>;

const dictionaries: Record<LanguageCode, Dictionary> = {
  en: {
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
    "guide.title": "How to use",
    "guide.step1": "Choose language in the top-right switcher.",
    "guide.step2": "Go to C2 and paste one target per line.",
    "guide.step3": "Select profiles and click Launch Enterprise Scan.",
    "guide.step4": "Monitor worker status and OAST callbacks in real-time.",
    "c2.title": "C2 Command & Task Dispatcher",
    "c2.subtitle": "Dispatch targets to Master Grid Node and monitor real-time worker capabilities.",
    "c2.refresh": "Refresh Grid",
  },
  vi: {
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
    "guide.title": "Hướng dẫn sử dụng",
    "guide.step1": "Chọn ngôn ngữ ở bộ chọn góc phải trên cùng.",
    "guide.step2": "Vào màn C2 và dán mục tiêu, mỗi dòng một domain/IP.",
    "guide.step3": "Chọn profile quét rồi bấm Launch Enterprise Scan.",
    "guide.step4": "Theo dõi trạng thái worker và callback OAST theo thời gian thực.",
    "c2.title": "Bảng Điều Khiển C2 & Điều Phối Tác Vụ",
    "c2.subtitle": "Đẩy mục tiêu vào Master Grid Node và giám sát năng lực worker theo thời gian thực.",
    "c2.refresh": "Làm mới Grid",
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

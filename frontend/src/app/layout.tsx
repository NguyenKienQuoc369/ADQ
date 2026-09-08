import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { AuthProvider } from "@/components/providers/auth-provider";
import { AppChrome } from "@/components/app-chrome";
import LockBanner from "@/components/ui/lock-banner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeScript } from "@/components/providers/theme-script";
import { LanguageProvider } from "@/lib/i18n";
import { MaintenanceGate } from "@/components/maintenance/maintenance-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ADQ SECURITY | Nền Tảng Đánh Giá An Ninh & Phản Ứng Tự Động Hóa",
    template: "%s | ADQ SECURITY",
  },
  description:
    "ADQ SECURITY - Giải pháp rà quét lỗ hổng DAST tự động, kiểm thử tải Layer 7 Stress Test và trợ lý vá lỗi bằng AI Copilot dành cho doanh nghiệp.",
  keywords: [
    "ADQ SECURITY",
    "DAST Web Scan",
    "Security Automation",
    "Layer 7 Stress Test",
    "AI Copilot Triage",
    "APK Security Audit",
    "OWASP Top 10",
  ],
  metadataBase: new URL("https://adq.io.vn"),
  openGraph: {
    title: "ADQ SECURITY | Nền Tảng Đánh Giá An Ninh & Phản Ứng Tự Động Hóa",
    description:
      "Tự động hóa rà soát bề mặt tấn công, rà quét lỗ hổng OWASP Top 10 và tạo bản vá mã nguồn tức thì bằng AI Copilot.",
    url: "https://adq.io.vn",
    siteName: "ADQ SECURITY",
    images: [
      {
        url: "/images/hero-cockpit.jpg",
        width: 1200,
        height: 630,
        alt: "ADQ SECURITY Console Preview",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ADQ SECURITY | Nền Tảng Đánh Giá An Ninh & Phản Ứng Tự Động Hóa",
    description:
      "Tự động hóa rà soát bề mặt tấn công, rà quét lỗ hổng OWASP Top 10 và tạo bản vá mã nguồn tức thì bằng AI Copilot.",
    images: ["/images/hero-cockpit.jpg"],
  },
  icons: {
    icon: [
      {
        url: "/icon.png?v=3",
        sizes: "any",
        type: "image/png",
      },
      {
        url: "/favicon.ico?v=3",
        sizes: "any",
      },
    ],
    shortcut: "/icon.png?v=3",
    apple: "/apple-icon.png?v=3",
  },
};

function isSocHost(host: string) {
  const cleanHost = host
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];

  return (
    cleanHost === "adq-soc.click" ||
    cleanHost === "www.adq-soc.click" ||
    cleanHost.startsWith("admin.")
  );
}

const jsonLdSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "ADQ SECURITY",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "Web, Cloud",
      "url": "https://adq.io.vn",
      "description":
        "Nền tảng hỗ trợ rà soát bề mặt tấn công, rà quét lỗ hổng DAST tự động, kiểm thử tải Layer 7 Stress Test và phân tích vá lỗi bằng AI Copilot.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "VND",
        "availability": "https://schema.org/InStock",
      },
      "author": {
        "@type": "Organization",
        "name": "ADQ SECURITY",
        "url": "https://adq.io.vn",
      },
    },
    {
      "@type": "Organization",
      "name": "ADQ SECURITY",
      "url": "https://adq.io.vn",
      "logo": "https://adq.io.vn/icon.png",
      "sameAs": ["https://adq.io.vn"],
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "ADQ Security quét lỗ hổng theo những tiêu chuẩn nào?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "ADQ Security tích hợp rà quét DAST tự động tuân thủ tiêu chuẩn OWASP Top 10, CWE/SANS Top 25 và CVSS v3.1.",
          },
        },
        {
          "@type": "Question",
          "name": "Hệ thống có yêu cầu cài đặt Agent không?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "Không. ADQ Security vận hành 100% Agentless SaaS Cloud không can thiệp vào máy chủ gốc.",
          },
        },
      ],
    },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();

  const host =
    headerStore.get("x-forwarded-host") ||
    headerStore.get("host") ||
    "";

  const socRealm = isSocHost(host);

  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full font-sans antialiased"
      >
        <ThemeProvider>
          <LanguageProvider>
            {socRealm ? (
              /*
               * SOC REALM
               *
               * Không mount:
               * - User AuthProvider
               * - User LockBanner
               * - User onboarding redirect
               * - User maintenance redirect
               *
               * adq-soc.click có auth/session riêng.
               */
              <div className="app-background flex min-h-screen flex-col">
                <AppChrome>{children}</AppChrome>
              </div>
            ) : (
              /*
               * USER REALM
               */
              <AuthProvider>
                <LockBanner />

                <div className="app-background flex min-h-screen flex-col">
                  <AppChrome>
                    <MaintenanceGate>
                      {children}
                    </MaintenanceGate>
                  </AppChrome>
                </div>
              </AuthProvider>
            )}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

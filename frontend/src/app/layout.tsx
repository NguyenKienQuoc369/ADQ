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
  title: "ADQ SECURITY",
  description:
    "Security operations platform for asset monitoring, vulnerability management and access control.",
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
      <body
        suppressHydrationWarning
        className="min-h-full font-sans antialiased"
      >
        <ThemeProvider>
          <ThemeScript />

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

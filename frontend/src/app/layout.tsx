import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { AppChrome } from "@/components/app-chrome";
import LockBanner from "@/components/ui/lock-banner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeScript } from "@/components/providers/theme-script";
import { LanguageProvider } from "@/lib/i18n";

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
  description: "Security operations platform for asset monitoring, vulnerability management and access control.",
  icons: {
    icon: [
      { url: "/icon.png?v=3", sizes: "any", type: "image/png" },
      { url: "/favicon.ico?v=3", sizes: "any" }
    ],
    shortcut: "/icon.png?v=3",
    apple: "/apple-icon.png?v=3",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`} data-scroll-behavior="smooth">
      <body suppressHydrationWarning className="min-h-full font-sans antialiased">
        <ThemeProvider>
          <ThemeScript />
          <LanguageProvider>
            <AuthProvider>
              <LockBanner />
              <div className="app-background flex min-h-screen flex-col">
                <AppChrome>{children}</AppChrome>
              </div>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

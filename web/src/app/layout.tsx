import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ADQ Enterprise DAST/ASM Security Console",
  description: "Distributed Security Operations, Attack Surface Management, Knowledge Graph & OAST Triage Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full bg-zinc-950 text-zinc-100 font-sans flex flex-col antialiased">
        <Navigation />
        <main className="flex-1 bg-zinc-950">{children}</main>
      </body>
    </html>
  );
}

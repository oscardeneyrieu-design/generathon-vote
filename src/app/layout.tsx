import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { LiveProvider } from "@/lib/use-live";

import "./globals.css";

// La police de generathon.tech.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pronostics — Generathon",
  description: "Parie sur le projet qui va gagner chaque track et gagne des points.",
  // Page éphémère partagée par QR code : elle ne doit pas concurrencer le
  // site de l'événement dans les moteurs de recherche.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={geist.variable}>
      <body className="flex min-h-dvh flex-col">
        <LiveProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </LiveProvider>
      </body>
    </html>
  );
}

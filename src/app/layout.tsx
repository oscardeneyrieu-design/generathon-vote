import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import "./globals.css";

// Un seul grotesque pour tout le produit. L'axe de largeur fournit le
// contraste d'affiche sans introduire une seconde famille.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Public vote",
  description: "Bet on which project wins each track. Live standings.",
  // Le vote est un écran éphémère destiné à être partagé par QR, pas une
  // page à référencer : elle ne doit pas concurrencer le site de l'événement.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f4f4f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={archivo.variable}>
      <body>
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/site/Header";
import { PRODUCT_NAME, SITE_URL, TAGLINE, pageMeta } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const base = pageMeta(PRODUCT_NAME);
export const metadata: Metadata = {
  ...base,
  metadataBase: new URL(SITE_URL),
  applicationName: PRODUCT_NAME,
  openGraph: { ...base.openGraph, title: `${PRODUCT_NAME}: ${TAGLINE.toLowerCase()}`, url: "/" },
  twitter: { ...base.twitter, title: `${PRODUCT_NAME}: ${TAGLINE.toLowerCase()}` },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}>
        <Header />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
            {PRODUCT_NAME} · protótipo do Hackathon VALORANT (USP São Carlos / SEMCOMP 2026). Dados das partidas fornecidos pela organização.
          </p>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import HashOpener from "@/components/site/HashOpener";
import PrintHeader from "@/components/site/PrintHeader";
import Sidebar from "@/components/site/Sidebar";
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

// fonte condensada dos títulos (identidade visual); licença OFL
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} antialiased`}>
        <Sidebar />
        <HashOpener />
        <div data-print-main className="flex min-h-screen flex-col lg:pl-60">
          <PrintHeader />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:justify-between">
              <div className="space-y-2">
                <p className="label-caps text-[10px]">{PRODUCT_NAME} · protótipo do Hackathon VALORANT (USP São Carlos / SEMCOMP 2026)</p>
                <p className="label-caps flex gap-4 text-[10px]">
                  <Link href="/como-funciona" className="text-ink-2 hover:text-lime">Como usar</Link>
                  <Link href="/metodologia" className="text-ink-2 hover:text-lime">Metodologia</Link>
                </p>
              </div>
              <p className="max-w-xl sm:text-right">
                {PRODUCT_NAME} foi criado sob a política “Legal Jibber Jabber” da Riot Games, usando recursos de propriedade da Riot Games.
                A Riot Games não endossa nem patrocina este projeto. Dados das partidas fornecidos pela organização do hackathon.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

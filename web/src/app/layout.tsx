import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import { Fragment } from "react";
import HashOpener from "@/components/site/HashOpener";
import PrintHeader from "@/components/site/PrintHeader";
import Sidebar from "@/components/site/Sidebar";
import { PRODUCT_NAME, SITE_URL, TAGLINE, TEAM, pageMeta } from "@/lib/site";
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
        <div data-print-main className="flex min-h-screen flex-col lg:pl-60 lg:has-[[data-landing]]:pl-0">
          <PrintHeader />
          <div className="flex-1">{children}</div>
          {/* rodapé: o produto e quem fez (cada nome leva ao LinkedIn) e, embaixo, o aviso da política da Riot */}
          <footer className="border-t border-line">
            <div className="mx-auto max-w-4xl space-y-2 px-4 py-6 text-center text-xs text-muted">
              <p className="leading-relaxed text-ink-2">
                {PRODUCT_NAME} · Desenvolvido por{" "}
                {TEAM.map((m, i) => (
                  <Fragment key={m.name}>
                    {i > 0 && (i === TEAM.length - 1 ? " e " : ", ")}
                    <a href={m.href} target="_blank" rel="noopener noreferrer"
                       className="whitespace-nowrap font-semibold text-ink underline decoration-ink-2/50 underline-offset-4 transition-colors hover:text-lime hover:decoration-lime">
                      {m.name}
                    </a>
                  </Fragment>
                ))}
              </p>
              <p className="mx-auto max-w-3xl text-[11px] leading-relaxed">
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

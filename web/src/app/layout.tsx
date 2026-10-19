import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/site/Header";
import { PRODUCT_NAME } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "O analista que times universitários não têm: impacto real de cada jogada, momentos decisivos e sinergia dos times do UNIVAVÁ.",
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

// Constantes do site (nome provisório do produto) e metadados da prévia de link (Discord, WhatsApp...).
import type { Metadata } from "next";

export const PRODUCT_NAME = "Analista UNIVAVÁ";
export const SITE_URL = "https://analista-univava.vercel.app";
export const TAGLINE = "O analista que os times universitários não têm";
export const SITE_DESCRIPTION =
  "Análise pós-partida do VALORANT universitário: impacto real de cada jogada, momentos decisivos, sinergia dos times e o papel que cada jogador realmente joga.";

/**
 * Título, descrição e prévia de link de uma página. O openGraph de uma página substitui o do layout inteiro
 * (inclusive a imagem de app/opengraph-image.tsx), por isso cada página repete aqui os campos comuns e a imagem.
 */
const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${PRODUCT_NAME}: ${TAGLINE.toLowerCase()}` };

export function pageMeta(title: string, description = SITE_DESCRIPTION): Metadata {
  return {
    title,
    description,
    openGraph: { type: "website", locale: "pt_BR", siteName: PRODUCT_NAME, title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

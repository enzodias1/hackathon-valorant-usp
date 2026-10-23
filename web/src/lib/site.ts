// Constantes do site (nome do produto) e metadados da prévia de link (Discord, WhatsApp...).
import type { Metadata } from "next";

export const PRODUCT_NAME = "Espreitador"; // a habilidade da Fade que persegue e revela o inimigo
export const SITE_URL = "https://espreitador-gg.vercel.app";
export const TAGLINE = "O analista que os times universitários não têm";
/** A equipe, na ordem do rodapé; cada nome leva ao LinkedIn. */
export const TEAM = [
  { name: "Enzo", href: "https://www.linkedin.com/in/enzo-dias-3125ba341/" },
  { name: "Azi", href: "https://www.linkedin.com/in/ana-bomfim/" },
  { name: "Brunno", href: "https://www.linkedin.com/in/brunnobernardes/" },
  { name: "João Pedro", href: "https://www.linkedin.com/in/jo%C3%A3o-pedro-matos-939919250/" },
  { name: "Camila", href: "https://www.linkedin.com/in/camila-vuicik-dos-santos-b38a2826b/" },
];
export const SITE_DESCRIPTION =
  "Análise pós-partida do VALORANT universitário: impacto real de cada jogada, momentos decisivos, o replay 2D de cada round e a sinergia dos times.";

/**
 * Título, descrição e prévia de link de uma página. O openGraph de uma página substitui o do layout inteiro
 * (inclusive a imagem de app/opengraph-image.tsx), por isso cada página repete aqui os campos comuns e a imagem.
 */
const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${PRODUCT_NAME}: ${TAGLINE.toLowerCase()}` };

export function pageMeta(title: string, description = SITE_DESCRIPTION, image: { url: string; alt: string } = OG_IMAGE): Metadata {
  const img = { ...OG_IMAGE, ...image };
  return {
    title,
    description,
    openGraph: { type: "website", locale: "pt_BR", siteName: PRODUCT_NAME, title, description, images: [img] },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

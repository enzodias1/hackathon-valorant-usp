// Primeira tela do site: a apresentação do projeto, em tela inteira e sem o menu. O "Curtiu? Bora testar?" no fim leva a /inicio.
import type { Metadata } from "next";
import PresentationDeck from "@/components/site/PresentationDeck";
import { PRODUCT_NAME, TAGLINE, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(`${PRODUCT_NAME}: ${TAGLINE.toLowerCase()}`);

export default function Home() {
  return <PresentationDeck />;
}

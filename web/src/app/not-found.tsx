import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/site";
import { BandButton, PageBand } from "@/components/analise/ui";

export const metadata: Metadata = { title: `Página não encontrada · ${PRODUCT_NAME}` };

export default function NotFound() {
  return (
    <main>
      <PageBand kicker="Erro 404" title="Essa página não existe"
                actions={<>
                  <BandButton href="/inicio" primary>Início</BandButton>
                  <BandButton href="/times">Times</BandButton>
                  <BandButton href="/partidas">Partidas</BandButton>
                </>}>
        O link pode estar errado ou a partida, o time ou o jogador não faz parte da base (UNIVAVÁ e Rush Series). Tente começar por aqui:
      </PageBand>
    </main>
  );
}

import type { Metadata } from "next";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import { PageBand } from "@/components/analise/ui";
import { getIndex } from "@/lib/data";
import Comparator from "@/components/analise/Comparator";

export const metadata: Metadata = pageMeta(`Comparar times · ${PRODUCT_NAME}`, "Time × adversário: quem é favorito, em quais mapas cada um rende mais e como o adversário joga.");

export default async function ComparePage() {
  const index = await getIndex();
  return (
    <main>
      <PageBand kicker="Preparação para o próximo jogo" title="Time × adversário">
        Quem é favorito, em quais mapas cada um rende mais, como o adversário costuma jogar e quem são os jogadores que mais decidem rounds.
        Tudo a partir das partidas já disputadas: é preparação antes do jogo, não ajuda durante a partida.
      </PageBand>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <Comparator teams={index.team_list} />
      </div>
    </main>
  );
}

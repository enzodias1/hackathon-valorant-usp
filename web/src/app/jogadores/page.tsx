import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import PlayerTable, { type PlayerRow } from "@/components/listas/PlayerTable";
import { PageBand } from "@/components/analise/ui";

export const metadata: Metadata = pageMeta(`Jogadores · ${PRODUCT_NAME}`, "Impacto real por round de cada jogador, além do K/D.");

export default async function PlayersPage() {
  const index = await getIndex();
  // primeiro quem tem amostra suficiente, por impacto; depois o resto, por rounds jogados
  const players: PlayerRow[] = [...index.players]
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || (a.eligible ? b.wpa_per_round - a.wpa_per_round : b.rounds - a.rounds))
    .map((p) => ({ ...p, team_name: index.teams[p.team]?.name ?? p.team }));

  return (
    <main>
      <PageBand kicker="Impacto real, além do K/D" title="Jogadores">
        {players.length} jogadores. <b className="text-white">Impacto por round</b> é quanto, em média, as jogadas de cada um mudam a chance de o time vencer o round,
        em pontos de chance (de 45% para 76% são +31 pontos). O impacto aparece a partir de 60 rounds.
      </PageBand>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <PlayerTable players={players} />
      </div>
    </main>
  );
}

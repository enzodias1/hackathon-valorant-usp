import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME } from "@/lib/site";
import PlayerTable, { type PlayerRow } from "@/components/listas/PlayerTable";

export const metadata: Metadata = { title: `Jogadores · ${PRODUCT_NAME}` };

export default async function PlayersPage() {
  const index = await getIndex();
  // primeiro quem tem amostra suficiente, por impacto; depois o resto, por rounds jogados
  const players: PlayerRow[] = [...index.players]
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || (a.eligible ? b.wpa_per_round - a.wpa_per_round : b.rounds - a.rounds))
    .map((p) => ({ ...p, team_name: index.teams[p.team]?.name ?? p.team }));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">Jogadores</h1>
        <p className="max-w-3xl text-ink-2">
          {players.length} jogadores. <span className="text-ink">Impacto por round</span> é quanto, em média, as jogadas de cada um mudam a chance de o time vencer o round,
          em pontos percentuais. <span className="text-ink">Papel real</span> é descoberto pelo comportamento em jogo, não pelo agente. Os dois só aparecem a partir de 60 rounds.
        </p>
      </header>
      <PlayerTable players={players} />
    </main>
  );
}

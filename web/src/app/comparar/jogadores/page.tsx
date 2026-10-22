import type { Metadata } from "next";
import ExportPdf from "@/components/site/ExportPdf";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import { BandButton, PageBand } from "@/components/analise/ui";
import { getIndex } from "@/lib/data";
import PlayerComparator from "@/components/analise/PlayerComparator";

export const metadata: Metadata = pageMeta(`Comparar jogadores · ${PRODUCT_NAME}`,
  "Jogador × jogador: duelos diretos (ou a parceria, no mesmo time), impacto, K/D e as outras estatísticas lado a lado.");

export default async function ComparePlayersPage() {
  const index = await getIndex();
  const players = index.players.map((p) => ({ ...p, team_name: index.teams[p.team]?.name ?? p.team }));
  return (
    <main>
      <PageBand kicker="Comparar" title="Jogador × jogador" actions={<><BandButton href="/comparar">Comparar times</BandButton><ExportPdf /></>}>
        Quem venceu mais duelos entre os dois (ou, no mesmo time, quem cobre quem) e as estatísticas lado a lado, com a posição de cada
        um na liga. Bom para medir a evolução contra um rival ou escolher quem joga em cada função.
      </PageBand>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <PlayerComparator players={players} />
      </div>
    </main>
  );
}

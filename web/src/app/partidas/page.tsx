import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import MatchTable, { type MatchRow } from "@/components/listas/MatchTable";
import { PageBand } from "@/components/analise/ui";

export const metadata: Metadata = pageMeta(`Partidas · ${PRODUCT_NAME}`, "Todos os mapas do UNIVAVÁ e da Rush Series, com filtros por competição, time e mapa.");

export default async function MatchesPage() {
  const index = await getIndex();
  const team = (slug: string) => ({ slug, name: index.teams[slug]?.name ?? slug });
  const rows: MatchRow[] = [...index.matches]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({ id: m.id, date: m.date, competition: m.competition, stage: m.stage, map: m.map, red: team(m.red), blue: team(m.blue), score: m.score, winner: m.winner }));

  return (
    <main>
      <PageBand kicker="Univavá + Rush Series · 2026" title="Partidas">
        Todos os {rows.length} mapas. Abra uma partida para ver o placar round a round, a chance de vitória a cada kill, o replay no minimapa e as jogadas que decidiram o mapa.
      </PageBand>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <MatchTable rows={rows} />
      </div>
    </main>
  );
}

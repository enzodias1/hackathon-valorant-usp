import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME } from "@/lib/site";
import MatchTable, { type MatchRow } from "@/components/listas/MatchTable";

export const metadata: Metadata = { title: `Partidas · ${PRODUCT_NAME}` };

export default async function MatchesPage() {
  const index = await getIndex();
  const team = (slug: string) => ({ slug, name: index.teams[slug]?.name ?? slug });
  const rows: MatchRow[] = [...index.matches]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({ id: m.id, date: m.date, competition: m.competition, stage: m.stage, map: m.map, red: team(m.red), blue: team(m.blue), score: m.score, winner: m.winner }));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">Partidas</h1>
        <p className="max-w-3xl text-ink-2">
          Todos os {rows.length} mapas do UNIVAVÁ e da Rush Series. Abra uma partida para ver o placar round a round, a chance de vitória a cada kill e as jogadas que decidiram o mapa.
        </p>
      </header>
      <MatchTable rows={rows} />
    </main>
  );
}

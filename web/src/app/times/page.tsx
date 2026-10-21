import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import TeamTable from "@/components/listas/TeamTable";

export const metadata: Metadata = pageMeta(`Times · ${PRODUCT_NAME}`, "Os times universitários ranqueados por força, com diagnóstico, sinergia e evolução no campeonato.");

export default async function TeamsPage() {
  const index = await getIndex();
  const teams = [...index.team_list].sort((a, b) => b.maps - a.maps || a.name.localeCompare(b.name, "pt-BR"));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">Times</h1>
        <p className="max-w-3xl text-ink-2">
          {teams.length} times universitários, ordenados pela força. Na página de cada time: diagnóstico comparado com a liga, quem cobre quem, onde o time morre, a evolução no campeonato e as decisões de economia.
        </p>
      </header>
      <TeamTable teams={teams} />
    </main>
  );
}

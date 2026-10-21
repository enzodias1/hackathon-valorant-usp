import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import TeamTable from "@/components/listas/TeamTable";
import { PageBand } from "@/components/analise/ui";

export const metadata: Metadata = pageMeta(`Times · ${PRODUCT_NAME}`, "Os times universitários ranqueados por força, com diagnóstico, sinergia e evolução no campeonato.");

export default async function TeamsPage() {
  const index = await getIndex();
  const teams = [...index.team_list].sort((a, b) => b.maps - a.maps || a.name.localeCompare(b.name, "pt-BR"));

  return (
    <main>
      <PageBand kicker="Ranking por força" title="Times">
        {teams.length} times universitários. Na página de cada time: diagnóstico comparado com a liga, quem cobre quem, onde o time morre e a evolução no campeonato.
      </PageBand>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <TeamTable teams={teams} />
      </div>
    </main>
  );
}

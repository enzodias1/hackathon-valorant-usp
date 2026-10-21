import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { getIndex } from "@/lib/data";
import Comparator from "@/components/analise/Comparator";

export const metadata: Metadata = pageMeta("Comparar times · Analista UNIVAVÁ", "Time × adversário: quem é favorito, em quais mapas cada um rende mais e como o adversário joga e decide a economia.");

export default async function ComparePage() {
  const index = await getIndex();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Preparação para o próximo jogo</p>
        <h1 className="text-3xl font-bold text-ink">Time × adversário</h1>
        <p className="text-ink-2">
          Quem é favorito, em quais mapas cada um rende mais, como o adversário costuma jogar e decidir a economia, e quem são os jogadores
          que mais decidem rounds. Tudo a partir das partidas já disputadas: é preparação antes do jogo, não ajuda durante a partida.
        </p>
      </header>
      <Comparator teams={index.team_list} />
    </main>
  );
}

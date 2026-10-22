import type { Metadata } from "next";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import { getIndex, getMatch } from "@/lib/data";
import { computeHighlights, MAX_DEFUSES } from "@/lib/highlights";
import { PageBand, SectionHead } from "@/components/analise/ui";
import HighlightPlayCard from "@/components/destaques/HighlightPlayCard";
import ComebackCard from "@/components/destaques/ComebackCard";
import ChanceInfo from "@/components/analise/ChanceInfo";

export const metadata: Metadata = pageMeta(
  `Destaques do campeonato · ${PRODUCT_NAME}`,
  "As jogadas que mais mudaram rounds e as maiores viradas do UNIVAVÁ, cada uma com link para o replay no instante exato.",
);

export default async function HighlightsPage() {
  const index = await getIndex();
  const matches = await Promise.all(index.matches.map((m) => getMatch(m.id)));
  const { plays, comebacks } = computeHighlights(matches, 10);

  return (
    <main>
      <PageBand kicker={`${matches.length} partidas analisadas`} title="Destaques do campeonato">
        As jogadas que mais mudaram a chance de vitória de um round e as viradas mais improváveis, escolhidas automaticamente
        em todas as partidas da base. Cada uma abre o replay 2D no instante exato: material pronto para as redes sociais e a
        transmissão do UNIVAVÁ, sem procurar lance por lance no VOD.
      </PageBand>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-8">
        <section>
          <SectionHead n="01" title="Jogadas de maior impacto" info={<ChanceInfo />} />
          <p className="-mt-2 mb-4 text-sm text-ink-2">
            Kills, plants, desarmes e ressurreições que mais aumentaram a chance de vitória do time de quem agiu, antes → depois, com a
            situação na hora. No máximo {MAX_DEFUSES} desarmes: o modelo só percebe o desarme quando ele termina e credita os 7 segundos
            de uma vez, então, sem limite, a lista seria só de desarmes no último segundo ou com inimigos vivos.
          </p>
          <ol className="grid gap-4 md:grid-cols-2">
            {plays.map((p, i) => (
              <li key={`${p.match.id}-${p.round}-${p.t}`}><HighlightPlayCard item={p} rank={i + 1} /></li>
            ))}
          </ol>
        </section>

        <section>
          <SectionHead n="02" title="Maiores viradas" info={<ChanceInfo />} />
          <p className="-mt-2 mb-4 text-sm text-ink-2">
            Rounds em que o vencedor chegou à menor chance de vitória e mesmo assim ganhou, fora os que já aparecem nas jogadas acima.
            O replay abre no momento mais difícil.
          </p>
          <ol className="grid gap-4 md:grid-cols-2">
            {comebacks.map((c, i) => (
              <li key={`${c.match.id}-${c.round}`}><ComebackCard item={c} rank={i + 1} /></li>
            ))}
          </ol>
        </section>

        <p className="text-xs text-muted">
          Chance de vitória estimada pelo modelo a cada evento (veja a Metodologia). Ficam de fora rounds com dados inconsistentes,
          team kills e eventos depois do fim do round.
        </p>
      </div>
    </main>
  );
}

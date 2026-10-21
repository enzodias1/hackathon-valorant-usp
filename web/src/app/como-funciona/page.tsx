import Link from "next/link";
import type { Metadata } from "next";
import { getIndex, getModel } from "@/lib/data";
import { nick, num, pct, pp } from "@/lib/format";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import { BandButton, PageBand, SectionHead } from "@/components/analise/ui";

export const metadata: Metadata = pageMeta(`Como usar · ${PRODUCT_NAME}`, "Do seu time aos rounds que valem a revisão no VOD, em quatro passos, e o que cada número significa.");

// Guia para jogador e coach, sem estatística. A parte técnica (modelo, validação, testes) fica em /metodologia.
const MIN_ROUNDS_EXAMPLE = 100; // mesmo critério do ranking da página inicial

export default async function HowToUsePage() {
  const [index, model] = await Promise.all([getIndex(), getModel()]);
  const d = model.definitions;
  const c75 = model.calibration.reduce((a, b) => (Math.abs(b.p - 0.75) < Math.abs(a.p - 0.75) ? b : a));
  const far = model.trade_by_distance.find((t) => t.distance.startsWith(`${d.isolated_distance_m}`)) ?? model.trade_by_distance.at(-1)!;

  // exemplos tirados dos dados: o time mais forte, o caso "K/D baixo, impacto alto" e a última partida desse time
  const team = [...index.team_list].filter((t) => t.rounds >= MIN_ROUNDS_EXAMPLE).sort((a, b) => a.strength_rank - b.strength_rank)[0];
  const player = [...index.players].filter((p) => p.eligible && p.kd < 1).sort((a, b) => b.wpa_per_round - a.wpa_per_round)[0];
  const match = [...index.matches].filter((m) => m.red === team.slug || m.blue === team.slug).sort((a, b) => b.date.localeCompare(a.date))[0];
  const t = `/times/${team.slug}`;
  const pl = `/jogadores/${player.puuid}`;

  const steps = [
    { title: "Escolha um time", text: "O seu ou o do próximo adversário. A lista está ordenada pela força no campeonato.", href: "/times", label: "Times" },
    { title: "Leia o diagnóstico", text: "No topo da página do time: o que ele faz melhor e pior que a liga. Só aparece o que não é sorte.", href: `${t}#diagnostico`, label: "Exemplo" },
    { title: "Abra o que interessa", text: "Cada seção fechada mostra um resumo de uma linha. Clique para ver o detalhe; o botão “i” explica como ler.", href: `${t}#sinergia`, label: "Exemplo" },
    { title: "Leve para o VOD", text: "“Rounds para revisar no VOD” leva direto à partida, com a chance de vitória a cada kill e o replay do round no minimapa.", href: `${t}#vod`, label: "Exemplo" },
  ];

  const questions = [
    { q: "Quem do time mais se cobre, e quem fica sem cobertura?", where: "Time › Sinergia", href: `${t}#sinergia` },
    { q: "Onde o time morre sem chance de trade?", where: "Time › Onde o time morre", href: `${t}#zonas` },
    { q: "Quais rounds valem a revisão no VOD?", where: "Time › Rounds para revisar", href: `${t}#vod` },
    { q: "O time melhorou ao longo do campeonato?", where: "Time › Evolução", href: `${t}#evolucao` },
    { q: "Em quais mapas o time rende mais?", where: "Time › Mapas", href: `${t}#mapas` },
    { q: "Como joga o próximo adversário?", where: "Comparar", href: `/comparar?a=${team.slug}` },
    { q: `K/D abaixo de 1 quer dizer que o jogador não ajuda? (${nick(player.name)}: K/D ${num(player.kd, 2)}, impacto ${pp(player.wpa_per_round)} por round)`, where: "Jogador › De onde vem o impacto", href: `${pl}#impacto` },
    { q: "Que papel cada um realmente exerce em jogo?", where: "Jogador › Perfil de jogo", href: `${pl}#perfil` },
    { q: "Como foi aquele round, kill por kill?", where: "Partida › replay no minimapa", href: `/partidas/${match.id}` },
  ];

  const terms: [string, React.ReactNode][] = [
    ["Impacto", <>Quanto uma jogada mudou a chance de o time vencer o round. Uma kill que leva o time de 50% para 70% vale {pp(20, 0)}; uma kill num round já decidido vale quase nada.</>],
    ["Impacto por round", "A média do impacto de um jogador por round jogado. Mede o quanto ele decide rounds, não quantas kills faz."],
    ["Trade", `Vingar a morte de um aliado em até ${d.trade_window_s} segundos.`],
    ["Morte isolada", `Morrer com o aliado mais próximo a mais de ${d.isolated_distance_m} m. Quase nunca dá para trocar: só ${pct(far.trade_rate)} dessas mortes são vingadas.`],
    ["Round jogado fora", `O time chegou a ${pct(d.throw_wp)} ou mais de chance e perdeu. Bom material para revisar no VOD.`],
    ["Virada", `O time esteve com ${pct(d.comeback_wp)} ou menos de chance e venceu.`],
    ["Força", "Chance de vencer um round contra um time médio do campeonato, descontando a economia."],
    ["Confirmado", "Ponto forte ou fraco cuja diferença para a liga é grande demais para ser sorte. Diferenças menores não viram ponto forte nem fraco."],
  ];

  const roles: [string, string][] = [
    ["Entry", "Abre o round: disputa os primeiros duelos."],
    ["Support", "Joga para o time: assistências e trades."],
    ["Lurker", "Joga longe do time, pelos flancos."],
    ["Clutch", "Decide o fim do round: clutches e pós-plant."],
  ];

  return (
    <main>
      <PageBand kicker="Guia rápido" title="Como usar"
                actions={<>
                  <BandButton href="/times" primary>Escolher um time</BandButton>
                  <BandButton href="/metodologia">Ver a metodologia</BandButton>
                </>}>
        Do seu time aos rounds que valem a revisão no VOD. Tudo sai das partidas já jogadas: é análise pós-partida, nada é usado durante o jogo.
      </PageBand>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-8">
        <section>
          <SectionHead n="01" title="Em quatro passos" />
          <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex flex-col rounded-xl border border-line bg-surface p-5">
                <span className={`font-display text-5xl leading-none ${i === 0 ? "text-lime" : "text-brand-2/70"}`} aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display mt-4 text-xl uppercase leading-tight tracking-wide text-ink">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-2">{s.text}</p>
                <Link href={s.href} className="label-caps mt-4 self-start text-[11px] text-ink underline decoration-lime underline-offset-4 hover:text-lime">{s.label} →</Link>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <SectionHead n="02" title="Perguntas que o site responde" />
          <p className="-mt-1 mb-4 text-sm text-ink-2">
            Os links abrem exemplos reais: <b className="text-ink">{team.name}</b>, o time mais forte do campeonato, e <b className="text-ink">{nick(player.name)}</b>.
            Para o seu time, é só escolher na lista de times.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {questions.map((x) => (
              <li key={x.where}>
                <Link href={x.href} className="grid gap-1 px-5 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                  <span className="text-ink">{x.q}</span>
                  <span className="label-caps text-[10px] text-lime sm:whitespace-nowrap sm:text-right">{x.where} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHead n="03" title="O que os números significam" />
          <dl className="grid gap-x-8 gap-y-5 text-sm md:grid-cols-2">
            {terms.map(([term, def]) => (
              <div key={term} className="border-l-2 border-brand-2/60 pl-4">
                <dt className="font-semibold text-ink">{term}</dt>
                <dd className="mt-0.5 text-ink-2">{def}</dd>
              </div>
            ))}
          </dl>
          <h3 className="font-display mt-10 text-xl uppercase tracking-wide text-ink">Papel em jogo</h3>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Sai do que o jogador faz em jogo, não do agente que ele escolhe. Aparece a partir de {d.min_rounds_role} rounds.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map(([role, text]) => (
              <li key={role} className="rounded-xl border border-line bg-surface p-4">
                <span className="font-display text-2xl uppercase tracking-wide text-ink">{role}</span>
                <p className="mt-1 text-sm text-ink-2">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative isolate grid items-center gap-6 overflow-hidden rounded-xl bg-brand p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-8">
          <p className="font-display text-[clamp(3rem,7vw,4.5rem)] leading-none text-white" aria-hidden>
            {pct(c75.p)} <span className="text-lime">→</span> {pct(c75.y)}
          </p>
          <div>
            <h2 className="text-2xl tracking-wide text-white">Dá para confiar?</h2>
            <p className="mt-2 max-w-xl text-white/85">
              Quando o modelo diz {pct(c75.p)}, o time vence {pct(c75.y)} das vezes, em partidas que ele nunca viu no treino.
              E ponto forte ou fraco só aparece quando a diferença para a liga não pode ser explicada por sorte.
            </p>
            <div className="mt-5"><BandButton href="/metodologia">Ver a metodologia</BandButton></div>
          </div>
        </section>
      </div>
    </main>
  );
}

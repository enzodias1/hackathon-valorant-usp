// Página inicial do site (a raiz abre a apresentação; o "Bora testar?" e o logo trazem para cá).
import Link from "next/link";
import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import { competitionLabel, date, num, pct } from "@/lib/format";
import type { TeamSummary } from "@/lib/types";
import { SectionHead } from "@/components/analise/ui";

export const metadata: Metadata = pageMeta(`Início · ${PRODUCT_NAME}`);

const RANKING_SIZE = 6;
const RECENT_SIZE = 6;
const MIN_ROUNDS_RELIABLE = 100; // força com menos rounds é imprecisa: fica fora do ranking da página inicial

export default async function Home() {
  const index = await getIndex();
  const rounds = index.team_list.reduce((s, t) => s + t.rounds, 0) / 2;
  const ranking = [...index.team_list].filter((t) => t.rounds >= MIN_ROUNDS_RELIABLE)
    .sort((a, b) => a.strength_rank - b.strength_rank).slice(0, RANKING_SIZE);
  const recent = [...index.matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_SIZE);
  const name = (slug: string) => index.teams[slug]?.name ?? slug;
  const last = recent[0];

  return (
    <main>
      <Hero stats={[[index.matches.length, "Mapas"], [rounds, "Rounds"], [index.team_list.length, "Times"], [index.players.length, "Jogadores"]]} />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
        <SectionHead n="01" title="Ranking de times" link={{ href: "/times", label: `Ver os ${index.team_list.length} times` }} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5">
            <thead>
              <tr className="label-caps text-[10px] text-muted">
                <th className="px-4 py-2 text-left font-semibold">Nº</th>
                <th className="px-2 py-2 text-left font-semibold">Time</th>
                <th className="px-2 py-2 text-left font-semibold">Força</th>
                <th className="px-2 py-2 text-right font-semibold">Mapas</th>
                <th className="px-2 py-2 text-right font-semibold">V · D</th>
                <th className="px-4 py-2 text-right font-semibold">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((t, i) => <RankRow key={t.slug} t={t} pos={i + 1} top={i === 0} />)}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Força: chance de vencer um round contra um time médio, estimada pelo modelo descontando a economia. Só entram times com pelo menos {MIN_ROUNDS_RELIABLE} rounds.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <SectionHead n="02" title="Últimos confrontos" />
          <p className="mt-2 text-sm text-ink-2">{competitionLabel(last.competition, last.stage)}, {date(last.date)}. O placar em destaque indica o vencedor.</p>
          <Link href="/partidas" className="label-caps mt-4 inline-block text-[11px] text-ink underline decoration-lime underline-offset-4 hover:text-lime">
            Ver as {index.matches.length} partidas →
          </Link>
        </div>
        <ul className="space-y-1.5">
          {recent.map((m) => (
            <li key={m.id}>
              <Link href={`/partidas/${m.id}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-md bg-surface px-4 py-2.5 transition-colors hover:bg-surface-2">
                <span className="label-caps truncate text-[10px] text-muted">{m.map}</span>
                <span className={`truncate text-right text-sm ${m.winner === "Red" ? "font-semibold text-ink" : "text-ink-2"}`}>{name(m.red)}</span>
                <span className="flex gap-1">
                  <Score v={m.score.Red} win={m.winner === "Red"} />
                  <Score v={m.score.Blue} win={m.winner === "Blue"} />
                </span>
                <span className={`truncate text-sm ${m.winner === "Blue" ? "font-semibold text-ink" : "text-ink-2"}`}>{name(m.blue)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Hero({ stats }: { stats: [number, string][] }) {
  return (
    <section className="relative isolate overflow-hidden bg-brand">
      {/* arte oficial do Veto (política "Legal Jibber Jabber" da Riot): o nome estilizado ao fundo e o retrato à direita */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/agents/veto_bg.webp" alt="" aria-hidden className="pointer-events-none absolute -top-10 right-[2%] -z-10 hidden h-[115%] opacity-[0.12] lg:block xl:right-[8%]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/veto.webp" alt="" aria-hidden
           className="pointer-events-none absolute -bottom-6 right-[-18%] -z-10 h-[80%] opacity-20 [mask-image:linear-gradient(to_right,transparent_0%,black_30%)] lg:right-[-14%] lg:h-[104%] lg:opacity-100 xl:right-[-9%]" />
      <span aria-hidden className="absolute left-6 top-5 text-lg text-white/40">+</span>
      <span aria-hidden className="absolute bottom-5 left-6 text-lg text-white/40">+</span>

      <div className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-8 sm:pt-20">
        <div className="max-w-2xl">
          {/* "não têm" em linha própria com folga em cima: o til e o circunflexo da Anton passam da altura da linha e
              encostavam em "universitários"; a folga só nessa linha mantém o título compacto */}
          <h1 className="max-w-[12ch] text-[clamp(2.8rem,6.6vw,5.9rem)] leading-[1.02] text-white">
            O analista que os times universitários <span className="mt-[0.2em] block">não têm</span>
          </h1>
          <p className="label-caps mt-5 inline-block bg-lime px-4 py-2 text-sm text-bg [clip-path:polygon(0_0,100%_0,calc(100%-12px)_100%,0_100%)] sm:text-base">
            Análise pós-partida
          </p>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/85">
            K/D e ACS não dizem o que fazer. A cada kill, um modelo recalcula a chance de vitória do round. Com isso, mostramos as jogadas que
            decidiram cada mapa, o replay de cada round e quem cobre quem dentro do time.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/times" className="label-caps bg-bg px-6 py-3.5 text-[12px] text-white transition-colors [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)] hover:bg-black">
              Analisar um time
            </Link>
            <Link href="/partidas" className="label-caps border-2 border-white px-6 py-3 text-[12px] text-white transition-colors hover:bg-white hover:text-brand">
              Ver partidas
            </Link>
          </div>
        </div>

        <div className="mt-12 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([v, label]) => (
            <div key={label} className="relative px-4 py-3">
              <Brackets />
              <div className="font-display text-4xl leading-none text-white">{num(v)}</div>
              <div className="label-caps mt-1.5 text-[10px] text-white/75">{label}</div>
            </div>
          ))}
        </div>
        <p className="label-caps mt-3 text-[10px] text-white/60">{"// Temporada 2026 · Univavá + Rush Series"}</p>
      </div>
    </section>
  );
}

/** Cantoneiras de mira nos quatro cantos (como no protótipo). */
function Brackets() {
  const c = "absolute h-3 w-3 border-white/80";
  return (
    <span aria-hidden>
      <span className={`${c} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${c} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${c} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${c} bottom-0 right-0 border-b-2 border-r-2`} />
    </span>
  );
}

function RankRow({ t, pos, top }: { t: TeamSummary; pos: number; top: boolean }) {
  const cell = "bg-surface py-3 transition-colors group-hover:bg-surface-2";
  return (
    <tr className="group">
      <td className={`${cell} rounded-l-md px-4`}>
        <Link href={`/times/${t.slug}`} className={`font-display text-3xl leading-none ${top ? "text-lime" : "text-brand-2/70"}`}>
          {String(pos).padStart(2, "0")}
        </Link>
      </td>
      <td className={`${cell} px-2`}>
        <Link href={`/times/${t.slug}`} className="text-sm font-bold uppercase tracking-wide text-ink hover:underline">{t.name}</Link>
      </td>
      <td className={`${cell} px-2`}>
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 rounded-full bg-surface-2 sm:w-56" aria-hidden>
            <div className={`h-2 rounded-full ${top ? "bg-lime" : "bg-brand-2"}`} style={{ width: `${t.strength * 100}%` }} />
          </div>
          <span className="tabular text-sm font-semibold text-ink">{pct(t.strength)}</span>
        </div>
      </td>
      <td className={`${cell} tabular px-2 text-right text-sm text-ink-2`}>{t.maps}</td>
      <td className={`${cell} tabular px-2 text-right text-sm text-ink-2`}>{t.map_wins} · {t.maps - t.map_wins}</td>
      <td className={`${cell} tabular rounded-r-md px-4 text-right text-sm text-ink-2`}>{pct(t.round_win)}</td>
    </tr>
  );
}

function Score({ v, win }: { v: number; win: boolean }) {
  return (
    <span className={`font-display grid h-8 min-w-8 place-items-center px-1.5 text-lg leading-none ${win ? "bg-lime text-bg" : "bg-surface-2 text-ink-2"}`}>{v}</span>
  );
}

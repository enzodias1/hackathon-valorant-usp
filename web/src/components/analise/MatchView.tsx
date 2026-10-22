"use client";
// Tela interativa da partida: gráfico de momentum (chance de vitória do round, evento a evento, em toda a partida),
// faixa de rounds e replay do round selecionado. O round (e o instante) pode vir da URL: #round-12 ou #round-12@78.9 (segundos).
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Color, Match, Round, RoundEvent } from "@/lib/types";
import type { NavGridRaw } from "@/lib/navgrid";
import { clock, nick, pct, RESULT_PT } from "@/lib/format";
import RoundReplay from "@/components/analise/RoundReplay";
import ChanceInfo from "@/components/analise/ChanceInfo";
import { playVerb } from "@/lib/roundStory";

const ROUND_SPAN_MS = 145_000; // ~100 s de round + 45 s de spike: posição do evento dentro do "slot" do round

type Pt = { x: number; wp: number; up: number; down: number; round: number; label: string };

function parseHash(rounds: number) {
  const m = window.location.hash.match(/round-(\d+)(?:@(\d+(?:\.\d+)?))?/);
  const n = m ? Number(m[1]) : 0;
  return m && n >= 1 && n <= rounds ? { n, t: m[2] ? Number(m[2]) * 1000 : undefined } : null;
}

export default function MatchView({ match, nav }: { match: Match; nav: NavGridRaw | null }) {
  const [sel, setSel] = useState<number>(1);
  const [startT, setStartT] = useState<number | undefined>(undefined);
  const detailRef = useRef<HTMLDivElement>(null);
  const players = useMemo(() => Object.fromEntries(match.players.map((p) => [p.puuid, p])), [match]);
  const teamName = (c: Color) => match.teams[c].name;

  // abre o round (e o instante) da URL, ao carregar e a cada link da própria página
  useEffect(() => {
    const apply = () => {
      const h = parseHash(match.rounds.length);
      if (!h) return;
      setSel(h.n);
      setStartT(h.t);
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [match.rounds.length]);
  const pick = (n: number) => {
    setSel(n);
    setStartT(undefined);
  };

  const describe = (e: RoundEvent) => `${e.actor ? nick(players[e.actor]?.name) : "?"} ${playVerb(e, match.players, true)}`;

  const data: Pt[] = useMemo(() => {
    const pts: Pt[] = [];
    const push = (x: number, wp: number, round: number, label: string) =>
      pts.push({ x, wp, up: Math.max(wp, 0.5), down: Math.min(wp, 0.5), round, label });
    for (const r of match.rounds) {
      const x0 = r.n - 1;
      push(x0, r.wp_red_start, r.n, `Início do round ${r.n}`);
      for (const e of r.events) {
        if (e.after_round_end) continue;
        const x = x0 + Math.min(e.t / ROUND_SPAN_MS, 0.97);
        push(x, e.wp_red_before, r.n, describe(e));
        push(x, e.wp_red_after, r.n, describe(e));
      }
      push(x0 + 0.985, r.winner === "Red" ? 1 : 0, r.n, `Fim do round ${r.n}: ${teamName(r.winner)}`);
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match]);

  const round = match.rounds[sel - 1];

  return (
    <div className="space-y-6">
      <section data-pdf-section="Momentum da partida" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <header className="mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">Momentum da partida</h2>
            <ChanceInfo />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Chance de vitória do round a cada kill, plant e desarme. Acima do meio: vantagem de{" "}
            <span className="font-medium text-team-red">{teamName("Red")}</span>; abaixo: de{" "}
            <span className="font-medium text-team-blue">{teamName("Blue")}</span>.<span data-print-hide> Clique para abrir um round.</span>
          </p>
        </header>
        <div className="mb-1 flex justify-between pl-10 text-xs">
          <span className="text-team-red">▲ {teamName("Red")} favorito</span>
        </div>
        <div className="h-64 w-full" role="img" aria-label="Gráfico de momentum: chance de vitória de cada round ao longo da partida">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                           onClick={(s) => { const r = data[Number(s?.activeTooltipIndex)]?.round; if (r) pick(r); }}>
              <XAxis dataKey="x" type="number" domain={[0, match.rounds.length]} ticks={match.rounds.map((r) => r.n - 0.5)}
                     tickFormatter={(v) => String(Math.round(v + 0.5))} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval="preserveStartEnd" />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => (v === 0.5 ? "50%" : "100%")}
                     tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <ReferenceLine y={0.5} stroke="var(--axis)" />
              {match.rounds.length > 12 && <ReferenceLine x={12} stroke="var(--axis)" label={{ value: "intervalo", fill: "var(--muted)", fontSize: 10, position: "insideTopRight" }} />}
              <ReferenceLine x={sel - 1} stroke="var(--ink-2)" strokeOpacity={0.5} />
              <ReferenceLine x={sel - 0.015} stroke="var(--ink-2)" strokeOpacity={0.5} />
              <Area dataKey="up" baseValue={0.5} type="linear" stroke="none" fill="var(--team-red)" fillOpacity={0.35} isAnimationActive={false} />
              <Area dataKey="down" baseValue={0.5} type="linear" stroke="none" fill="var(--team-blue)" fillOpacity={0.35} isAnimationActive={false} />
              <Line dataKey="wp" type="linear" stroke="var(--ink-2)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Tooltip cursor={{ stroke: "var(--ink-2)", strokeOpacity: 0.4 }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Pt;
                const fav: Color = d.wp >= 0.5 ? "Red" : "Blue";
                return (
                  <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink shadow-lg">
                    <b>Round {d.round}</b> · {d.label}<br />
                    <span className={fav === "Red" ? "text-team-red" : "text-team-blue"}>●</span> {teamName(fav)} {pct(fav === "Red" ? d.wp : 1 - d.wp)}
                  </div>
                );
              }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 pl-10 text-xs"><span className="text-team-blue">▼ {teamName("Blue")} favorito</span></div>

        {/* botões dos rounds: no PDF não servem (o gráfico acima já mostra cada round) */}
        <div data-print-hide className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Rounds">
          {match.rounds.map((r) => (
            <button key={r.n} role="tab" aria-selected={r.n === sel} onClick={() => pick(r.n)}
                    title={`Round ${r.n}: ${teamName(r.winner)} (${RESULT_PT[r.result]})`}
                    className={`flex h-9 w-9 flex-col items-center justify-center rounded-md border text-xs tabular transition ${r.n === sel ? "border-ink bg-surface-2" : "border-line hover:border-ink-2"}`}>
              <span className="text-ink">{r.n}</span>
              <span className={`h-1 w-5 rounded-full ${r.winner === "Red" ? "bg-team-red" : "bg-team-blue"}`} />
            </button>
          ))}
        </div>
        <p data-print-hide className="mt-2 text-xs text-muted">A cor embaixo do número indica quem venceu o round.</p>
      </section>

      {/* scroll-mt: margem para o cabeçalho fixo do site não cobrir o topo do round */}
      <div ref={detailRef} id={`round-${sel}`} className="scroll-mt-24">
        <RoundDetail match={match} round={round} nav={nav} startT={startT} onPrev={() => pick(Math.max(1, sel - 1))} onNext={() => pick(Math.min(match.rounds.length, sel + 1))} />
      </div>
    </div>
  );
}

function RoundDetail({ match, round, nav, startT, onPrev, onNext }: {
  match: Match; round: Round; nav: NavGridRaw | null; startT?: number; onPrev: () => void; onNext: () => void;
}) {
  const atk = round.attacker, def: Color = atk === "Red" ? "Blue" : "Red";
  const tn = (c: Color) => match.teams[c].name;
  return (
    // no PDF o replay sairia como foto de um instante: a seção começa desmarcada na lista do "Exportar PDF"
    <section data-pdf-section={`Round ${round.n}: detalhe e replay`} data-pdf-default="off" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl tracking-wide text-ink">Round {round.n} <span className="text-base text-muted">· {round.half}</span></h2>
          <p className="mt-1 text-sm text-ink-2">
            <span className="text-atk">●</span> Ataque: {tn(atk)} ({round.buy[atk]}) · <span className="text-def">●</span> Defesa: {tn(def)} ({round.buy[def]})
          </p>
          <p className="mt-1 text-sm text-ink">
            Vencedor: <span className={round.winner === "Red" ? "text-team-red" : "text-team-blue"}>{tn(round.winner)}</span> · {RESULT_PT[round.result]}
            {round.plant && <> · spike no {round.plant.site} aos {clock(round.plant.t)}</>}
            {round.anomalous && <span className="text-warn"> · round com erro na base de dados</span>}
          </p>
        </div>
        <div data-print-hide className="flex gap-2">
          <button onClick={onPrev} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-2">← anterior</button>
          <button onClick={onNext} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-2">próximo →</button>
        </div>
      </header>
      <RoundReplay match={match} round={round} initialT={startT} nav={nav} />
    </section>
  );
}

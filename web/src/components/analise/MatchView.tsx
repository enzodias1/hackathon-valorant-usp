"use client";
// Tela interativa da partida: gráfico de momentum (chance de vitória do round, evento a evento, em toda a partida),
// faixa de rounds e detalhe do round selecionado. O round inicial pode vir da URL (#round-12).
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Color, Match, Round, RoundEvent } from "@/lib/types";
import { clock, nick, pct, pp, RESULT_PT } from "@/lib/format";

const ROUND_SPAN_MS = 145_000; // ~100 s de round + 45 s de spike: posição do evento dentro do "slot" do round

type Pt = { x: number; wp: number; up: number; down: number; round: number; label: string };

export default function MatchView({ match, minimap }: { match: Match; minimap?: React.ReactNode }) {
  const [sel, setSel] = useState<number>(1);
  const detailRef = useRef<HTMLDivElement>(null);
  const players = useMemo(() => Object.fromEntries(match.players.map((p) => [p.puuid, p])), [match]);
  const teamName = (c: Color) => match.teams[c].name;

  useEffect(() => {
    const m = window.location.hash.match(/round-(\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= match.rounds.length) {
        setSel(n);
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    }
  }, [match.rounds.length]);

  const describe = (e: RoundEvent) => {
    const who = e.actor ? nick(players[e.actor]?.name) : "?";
    if (e.type === "plant") return `${who} plantou a spike`;
    if (e.type === "defuse") return `${who} desarmou a spike`;
    return `${who} matou ${nick(players[e.victim ?? ""]?.name)}${e.weapon ? ` (${e.weapon})` : ""}`;
  };

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
      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-ink">Momentum da partida</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Chance de vitória do round a cada kill, plant e desarme. Acima do meio: vantagem de{" "}
            <span className="font-medium text-team-red">{teamName("Red")}</span>; abaixo: de{" "}
            <span className="font-medium text-team-blue">{teamName("Blue")}</span>. Clique para abrir um round.
          </p>
        </header>
        <div className="mb-1 flex justify-between pl-10 text-xs">
          <span className="text-team-red">▲ {teamName("Red")} favorito</span>
        </div>
        <div className="h-64 w-full" role="img" aria-label="Gráfico de momentum: chance de vitória de cada round ao longo da partida">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                           onClick={(s) => { const r = data[Number(s?.activeTooltipIndex)]?.round; if (r) setSel(r); }}>
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

        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Rounds">
          {match.rounds.map((r) => (
            <button key={r.n} role="tab" aria-selected={r.n === sel} onClick={() => setSel(r.n)}
                    title={`Round ${r.n}: ${teamName(r.winner)} (${RESULT_PT[r.result]})`}
                    className={`flex h-9 w-9 flex-col items-center justify-center rounded-md border text-xs tabular transition ${r.n === sel ? "border-ink bg-surface-2" : "border-line hover:border-ink-2"}`}>
              <span className="text-ink">{r.n}</span>
              <span className={`h-1 w-5 rounded-full ${r.winner === "Red" ? "bg-team-red" : "bg-team-blue"}`} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">A cor embaixo do número indica quem venceu o round.</p>
      </section>

      {/* scroll-mt: margem para o cabeçalho fixo do site não cobrir o topo do round */}
      <div ref={detailRef} id={`round-${sel}`} className="scroll-mt-24">
        <RoundDetail match={match} round={round} describe={describe} minimap={minimap} onPrev={() => setSel(Math.max(1, sel - 1))} onNext={() => setSel(Math.min(match.rounds.length, sel + 1))} />
      </div>
    </div>
  );
}

function RoundDetail({ match, round, describe, minimap, onPrev, onNext }: {
  match: Match; round: Round; describe: (e: RoundEvent) => string; minimap?: React.ReactNode; onPrev: () => void; onNext: () => void;
}) {
  const atk = round.attacker, def: Color = atk === "Red" ? "Blue" : "Red";
  const tn = (c: Color) => match.teams[c].name;
  const actorColor = (e: RoundEvent) => match.players.find((p) => p.puuid === e.actor)?.color;
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Round {round.n} <span className="text-sm font-normal text-muted">· {round.half}</span></h2>
          <p className="mt-1 text-sm text-ink-2">
            <span className="text-atk">●</span> Ataque: {tn(atk)} ({round.buy[atk]}) · <span className="text-def">●</span> Defesa: {tn(def)} ({round.buy[def]})
          </p>
          <p className="mt-1 text-sm text-ink">
            Vencedor: <span className={round.winner === "Red" ? "text-team-red" : "text-team-blue"}>{tn(round.winner)}</span> · {RESULT_PT[round.result]}
            {round.plant && <> · spike no {round.plant.site} aos {clock(round.plant.t)}</>}
            {round.anomalous && <span className="text-warn"> · round com erro na base de dados</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onPrev} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-2">← anterior</button>
          <button onClick={onNext} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-2">próximo →</button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-xs text-muted">Chance de vitória antes da primeira kill: {tn("Red")} {pct(round.wp_red_start)} · {tn("Blue")} {pct(1 - round.wp_red_start)} (só pela economia)</p>
          <ol className="divide-y divide-line/50">
            {round.events.map((e, i) => {
              const c = actorColor(e);
              const mine = c === "Blue" ? [1 - e.wp_red_before, 1 - e.wp_red_after] : [e.wp_red_before, e.wp_red_after];
              return (
                <li key={i} className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm ${e.after_round_end ? "opacity-40" : ""}`}>
                  <span className="tabular text-muted">{clock(e.t)}</span>
                  <span className="text-ink">
                    <span className={c === "Red" ? "text-team-red" : c === "Blue" ? "text-team-blue" : "text-muted"}>●</span>{" "}
                    {describe(e)}
                    {e.first_blood && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2">first blood</span>}
                    {e.is_trade && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2">trade</span>}
                    {e.after_round_end && <span className="ml-2 text-xs text-muted">(após o fim do round)</span>}
                  </span>
                  <span className="tabular text-right text-xs">
                    <span className="text-ink-2">{pct(mine[0])} → {pct(mine[1])}</span>
                    <span className={`block ${e.wpa >= 0 ? "text-good" : "text-bad"}`}>{e.after_round_end ? "" : pp(e.wpa)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs text-muted">Porcentagens: chance de vitória do time de quem agiu, antes → depois.</p>
        </div>
        <div>
          {minimap ?? (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">
              Minimapa do round (em construção)
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

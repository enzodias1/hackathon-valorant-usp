"use client";
// Comparador: o histórico do confronto entre os dois times. Lê as partidas entre eles e mostra o placar, quem decidiu e o
// momento que mais pesou em cada mapa, com link para o replay naquele instante.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Color, Match, Round, RoundEvent, Team } from "@/lib/types";
import { date, nick, num, pp } from "@/lib/format";
import { playVerb, roundStory } from "@/lib/roundStory";
import ChanceInfo from "./ChanceInfo";

type Key = { round: Round; e: RoundEvent };

/** A jogada de maior impacto da partida (fora as que vieram depois do fim do round). */
function decisive(m: Match): Key | null {
  let best: Key | null = null;
  for (const round of m.rounds) {
    for (const e of round.events) {
      if (!e.after_round_end && e.actor && (!best || Math.abs(e.wpa) > Math.abs(best.e.wpa))) best = { round, e };
    }
  }
  return best;
}

export default function HeadToHead({ A, B, ids }: { A: Team; B: Team; ids: string[] }) {
  const key = ids.join(",");
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    let alive = true;
    setMatches(null);
    Promise.all(key.split(",").filter(Boolean).map((id) => fetch(`/data/matches/${id}.json`).then((r) => r.json() as Promise<Match>)))
      .then((ms) => alive && setMatches(ms.sort((x, y) => x.date.localeCompare(y.date))));
    return () => { alive = false; };
  }, [key]);

  if (!ids.length) return null;
  if (!matches) return <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-2">Carregando o histórico do confronto…</p>;

  const sideOf = (m: Match, slug: string): Color => (m.teams.Red.slug === slug ? "Red" : "Blue");
  let mapsA = 0, roundsA = 0, roundsB = 0;
  const players = new Map<string, { name: string; agents: Set<string>; team: "A" | "B"; kills: number; deaths: number; wpa: number }>();
  for (const m of matches) {
    const ca = sideOf(m, A.slug), cb: Color = ca === "Red" ? "Blue" : "Red";
    if (m.winner === ca) mapsA++;
    roundsA += m.score[ca];
    roundsB += m.score[cb];
    for (const p of m.players) {
      const cur = players.get(p.puuid) ?? { name: p.name, agents: new Set<string>(), team: p.color === ca ? "A" : "B", kills: 0, deaths: 0, wpa: 0 };
      cur.agents.add(p.agent);
      cur.kills += p.kills;
      cur.deaths += p.deaths;
      cur.wpa += p.wpa;
      players.set(p.puuid, cur);
    }
  }
  const top = (team: "A" | "B") => [...players.entries()].filter(([, p]) => p.team === team).sort((x, y) => y[1].wpa - x[1].wpa).slice(0, 3);

  return (
    <section data-pdf-section="Histórico do confronto" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl tracking-wide text-ink">Histórico do confronto</h2>
        <ChanceInfo />
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {matches.length} {matches.length === 1 ? "mapa" : "mapas"} entre os dois: <b className="text-ink">{A.name} {mapsA} × {matches.length - mapsA} {B.name}</b>
        {" "}({roundsA} × {roundsB} em rounds). Em cada mapa, o momento que mais mudou a chance de vitória, com link para o replay.
      </p>

      <ul className="mt-4 divide-y divide-line/60">
        {matches.map((m) => {
          const ca = sideOf(m, A.slug), cb: Color = ca === "Red" ? "Blue" : "Red";
          const won = m.winner === ca;
          const k = decisive(m);
          const actor = k ? m.players.find((p) => p.puuid === k.e.actor) : undefined;
          const what = k ? playVerb(k.e, m.players) : "";
          return (
            <li key={m.id} className="grid gap-3 py-4 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-start">
              <Link href={`/partidas/${m.id}`} className="group">
                <span className="label-caps block text-[10px] text-muted">{date(m.date)} · {m.map.name}</span>
                <span className="font-display text-2xl leading-tight text-ink group-hover:underline">
                  <span className={won ? "text-lime" : "text-ink-2"}>{m.score[ca]}</span> <span className="text-muted">×</span>{" "}
                  <span className={won ? "text-ink-2" : "text-lime"}>{m.score[cb]}</span>
                </span>
                <span className={`label-caps block text-[10px] ${won ? "text-good" : "text-bad"}`}>{won ? `${A.tag} venceu` : `${B.tag} venceu`}</span>
              </Link>
              {k && (
                <div className="min-w-0 text-sm">
                  <p className="text-ink">
                    <span className="text-muted">Round {k.round.n}:</span> {nick(actor?.name)} ({actor?.agent}) {what}{" "}
                    <b className={k.e.wpa >= 0 ? "text-good" : "text-bad"}>{pp(k.e.wpa)}</b>
                  </p>
                  <p className="mt-1 text-ink-2">{roundStory(m, k.round).slice(0, 2).join(" ")}</p>
                </div>
              )}
              {k && (
                <Link href={`/partidas/${m.id}#round-${k.round.n}@${(k.e.t / 1000).toFixed(1)}`}
                      className="label-caps self-start whitespace-nowrap text-[11px] text-ink underline decoration-lime underline-offset-4 hover:text-lime">
                  Ver no replay →
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        {(["A", "B"] as const).map((team) => (
          <div key={team}>
            <h3 className="label-caps mb-2 text-[11px] text-muted">Impacto nesses mapas: {team === "A" ? A.name : B.name}</h3>
            <ul className="space-y-1.5 text-sm">
              {top(team).map(([puuid, p]) => (
                <li key={puuid} className="flex items-baseline justify-between gap-3">
                  <Link href={`/jogadores/${puuid}`} className="min-w-0 truncate text-ink hover:underline">
                    {nick(p.name)} <span className="text-xs text-muted">({[...p.agents].join(", ")})</span>
                  </Link>
                  <span className="tabular shrink-0 text-xs">
                    <b className={p.wpa >= 0 ? "text-good" : "text-bad"}>{pp(p.wpa, 0)}</b>
                    <span className="text-muted"> · K/D {num(p.kills / Math.max(p.deaths, 1), 2)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Impacto: soma dos pontos de chance das jogadas de cada jogador nesses mapas, ou seja, quanto elas mudaram a chance de vitória dos rounds.</p>
    </section>
  );
}

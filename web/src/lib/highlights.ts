// Destaques do campeonato: as jogadas de maior impacto e as maiores viradas de todas as partidas da base.
// Lógica pura (sem leitura de arquivo): recebe as partidas já carregadas e devolve tudo pronto para os cards.
import type { Color, Match, MatchPlayer, Round, RoundEvent } from "@/lib/types";
import { competitionLabel, nick, RESULT_PT } from "@/lib/format";
import { ROUND_TIMER_MS } from "@/lib/minimap";
import { dur, roundStory } from "@/lib/roundStory";

const SPIKE_MS = 45_000;

/** Chance de vitória do time `color`, a partir da chance do Red. */
export const teamWp = (wpRed: number, color: Color): number => (color === "Blue" ? 1 - wpRed : wpRed);

/** Link para o replay 2D da partida no instante exato (mesmo formato do resto do site). */
export const replayHref = (matchId: string, round: number, tMs: number): string =>
  `/partidas/${matchId}#round-${round}@${(tMs / 1000).toFixed(1)}`;

/** O que os cards mostram sobre a partida. */
export interface MatchInfo {
  id: string;
  map: string;
  mapCode: string;
  date: string;
  competition: string;
  teams: Record<Color, string>;
  score: Record<Color, number>;
}

export interface PlayHighlight {
  match: MatchInfo;
  round: number;
  /** ms desde o início do round */
  t: number;
  href: string;
  actor: { name: string; agent: string; agentIcon: string | null; color: Color };
  /** "matou X com Vandal", "matou X", "plantou a spike" ou "desarmou a spike" */
  action: string;
  /** chance de vitória do time de quem agiu, antes e depois (0–1) */
  wpBefore: number;
  wpAfter: number;
  /** impacto, em pontos de chance */
  wpa: number;
  /** a situação na hora: "1 contra 2 · faltando 0,4 segundo para a explosão" */
  context: string;
}

export interface ComebackHighlight {
  match: MatchInfo;
  round: number;
  /** instante (ms) em que o vencedor teve a menor chance */
  t: number;
  href: string;
  winner: Color;
  scoreBefore: Record<Color, number>;
  /** menor chance de vitória do vencedor no round (0–1) */
  minWp: number;
  /** resultado em português ("Eliminação", "Desarme"...) */
  result: string;
  /** vivos do vencedor contra os do perdedor no pior momento */
  aliveThen: [number, number];
  /** o que decidiu o round (as frases do resumo do replay, sem a da virada, que o card já mostra) */
  story: string[];
}

const matchInfo = (m: Match): MatchInfo => ({
  id: m.id,
  map: m.map.name,
  mapCode: m.map.code,
  date: m.date,
  competition: competitionLabel(m.competition, m.stage),
  teams: { Red: m.teams.Red.name, Blue: m.teams.Blue.name },
  score: m.score,
});

const describe = (e: RoundEvent, players: Map<string, MatchPlayer>): string => {
  if (e.type === "plant") return "plantou a spike";
  if (e.type === "defuse") return "desarmou a spike";
  const victim = nick(players.get(e.victim ?? "")?.name);
  return e.weapon ? `matou ${victim} com ${e.weapon}` : `matou ${victim}`;
};

/** Vivos de cada time antes e depois de cada evento do round (ressurreições incluídas). */
function aliveCounts(m: Match, r: Round) {
  const color = new Map(m.players.map((p) => [p.puuid, p.color]));
  const alive: Record<Color, Set<string>> = {
    Red: new Set(m.players.filter((p) => p.color === "Red").map((p) => p.puuid)),
    Blue: new Set(m.players.filter((p) => p.color === "Blue").map((p) => p.puuid)),
  };
  const count = () => ({ Red: alive.Red.size, Blue: alive.Blue.size });
  const before: Record<Color, number>[] = [];
  const after: Record<Color, number>[] = [];
  for (const e of r.events) {
    for (const id of e.revived ?? []) {
      const c = color.get(id);
      if (c) alive[c].add(id);
    }
    before.push(count());
    if (e.type === "kill" && e.victim) {
      const c = color.get(e.victim);
      if (c) alive[c].delete(e.victim);
    }
    after.push(count());
  }
  return { before, after };
}

/** "1 contra 2 · faltando 0,4 segundo para a explosão": quantos de cada lado e quanto tempo restava, do ponto de vista de `side`. */
function situation(r: Round, e: RoundEvent, side: Color, n: Record<Color, number>) {
  const bits = [`${n[side]} contra ${n[side === "Red" ? "Blue" : "Red"]}`];
  if (e.type === "defuse" && r.plant) bits.push(`faltando ${dur(r.plant.t + SPIKE_MS - e.t)} para a explosão`);
  else if (r.plant && r.plant.t < e.t) bits.push(`spike plantada, faltando ${dur(r.plant.t + SPIKE_MS - e.t)} para explodir`);
  else if (ROUND_TIMER_MS - e.t <= 20_000) bits.push(`faltando ${dur(Math.max(0, ROUND_TIMER_MS - e.t))} de round`);
  return bits.join(" · ");
}

/** Ordem estável para desempates: partida, depois round, depois instante. */
const byPlace = (a: { match: MatchInfo; round: number; t: number }, b: { match: MatchInfo; round: number; t: number }) =>
  a.match.id.localeCompare(b.match.id) || a.round - b.round || a.t - b.t;

/** Jogada candidata: evento válido de um round válido, com ator conhecido. */
function playOf(m: Match, info: MatchInfo, r: Round, e: RoundEvent, players: Map<string, MatchPlayer>,
                aliveBefore: Record<Color, number>): PlayHighlight | null {
  if (e.after_round_end || e.teamkill || !e.actor) return null;
  const p = players.get(e.actor);
  if (!p || !Number.isFinite(e.wpa)) return null;
  return {
    match: info,
    round: r.n,
    t: e.t,
    href: replayHref(m.id, r.n, e.t),
    actor: { name: nick(p.name), agent: p.agent, agentIcon: p.agent_icon, color: p.color },
    action: describe(e, players),
    wpBefore: teamWp(e.wp_red_before, p.color),
    wpAfter: teamWp(e.wp_red_after, p.color),
    wpa: e.wpa,
    context: situation(r, e, p.color, aliveBefore),
  };
}

/** Menor chance do vencedor ao longo do round (início + depois de cada evento), com o instante em que ocorreu. */
function comebackOf(m: Match, info: MatchInfo, r: Round, after: Record<Color, number>[]): ComebackHighlight {
  let minWp = teamWp(r.wp_red_start, r.winner);
  let t = 0;
  let worst = -1;
  r.events.forEach((e, i) => {
    if (e.after_round_end) return;
    const wp = teamWp(e.wp_red_after, r.winner);
    if (wp < minWp) {
      minWp = wp;
      t = e.t;
      worst = i;
    }
  });
  const loser: Color = r.winner === "Red" ? "Blue" : "Red";
  const n = worst >= 0 ? after[worst] : { Red: 5, Blue: 5 };
  return {
    match: info,
    round: r.n,
    t,
    href: replayHref(m.id, r.n, t),
    winner: r.winner,
    scoreBefore: r.score_before,
    minWp,
    result: RESULT_PT[r.result] ?? r.result,
    aliveThen: [n[r.winner], n[loser]],
    story: roundStory(m, r).slice(1),
  };
}

/** Os dois rankings numa única passada pelas partidas. As viradas pulam os rounds que já estão nas jogadas, para não repetir. */
export function computeHighlights(matches: Match[], n = 10): { plays: PlayHighlight[]; comebacks: ComebackHighlight[] } {
  const plays: PlayHighlight[] = [];
  const comebacks: ComebackHighlight[] = [];
  for (const m of matches) {
    const info = matchInfo(m);
    const players = new Map(m.players.map((p) => [p.puuid, p]));
    for (const r of m.rounds) {
      if (r.anomalous) continue;
      const { before, after } = aliveCounts(m, r);
      const c = comebackOf(m, info, r, after);
      if (Number.isFinite(c.minWp)) comebacks.push(c);
      r.events.forEach((e, i) => {
        const p = playOf(m, info, r, e, players, before[i]);
        if (p) plays.push(p);
      });
    }
  }
  plays.sort((a, b) => b.wpa - a.wpa || byPlace(a, b));
  comebacks.sort((a, b) => a.minWp - b.minWp || byPlace(a, b));
  const top = plays.slice(0, n);
  const shown = new Set(top.map((p) => `${p.match.id}:${p.round}`));
  return { plays: top, comebacks: comebacks.filter((c) => !shown.has(`${c.match.id}:${c.round}`)).slice(0, n) };
}

/** Top `n` jogadas por impacto (kill, plant ou desarme). */
export const topPlays = (matches: Match[], n = 10): PlayHighlight[] => computeHighlights(matches, n).plays;

/** Top `n` rounds em que o vencedor chegou à menor chance de vitória e mesmo assim ganhou. */
export const biggestComebacks = (matches: Match[], n = 10): ComebackHighlight[] => computeHighlights(matches, n).comebacks;

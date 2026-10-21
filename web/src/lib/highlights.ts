// Destaques do campeonato: as jogadas de maior impacto e as maiores viradas de todas as partidas da base.
// Lógica pura (sem leitura de arquivo): recebe as partidas já carregadas e devolve tudo pronto para os cards.
import type { Color, Match, MatchPlayer, Round, RoundEvent } from "@/lib/types";
import { competitionLabel, nick, RESULT_PT } from "@/lib/format";

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
  /** impacto, em pontos percentuais */
  wpa: number;
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

/** Ordem estável para desempates: partida, depois round, depois instante. */
const byPlace = (a: { match: MatchInfo; round: number; t: number }, b: { match: MatchInfo; round: number; t: number }) =>
  a.match.id.localeCompare(b.match.id) || a.round - b.round || a.t - b.t;

/** Jogada candidata: evento válido de um round válido, com ator conhecido. */
function playOf(m: Match, info: MatchInfo, r: Round, e: RoundEvent, players: Map<string, MatchPlayer>): PlayHighlight | null {
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
  };
}

/** Menor chance do vencedor ao longo do round (início + depois de cada evento), com o instante em que ocorreu. */
function comebackOf(m: Match, info: MatchInfo, r: Round): ComebackHighlight {
  let minWp = teamWp(r.wp_red_start, r.winner);
  let t = 0;
  for (const e of r.events) {
    if (e.after_round_end) continue;
    const wp = teamWp(e.wp_red_after, r.winner);
    if (wp < minWp) {
      minWp = wp;
      t = e.t;
    }
  }
  return {
    match: info,
    round: r.n,
    t,
    href: replayHref(m.id, r.n, t),
    winner: r.winner,
    scoreBefore: r.score_before,
    minWp,
    result: RESULT_PT[r.result] ?? r.result,
  };
}

/** Os dois rankings numa única passada pelas partidas. */
export function computeHighlights(matches: Match[], n = 10): { plays: PlayHighlight[]; comebacks: ComebackHighlight[] } {
  const plays: PlayHighlight[] = [];
  const comebacks: ComebackHighlight[] = [];
  for (const m of matches) {
    const info = matchInfo(m);
    const players = new Map(m.players.map((p) => [p.puuid, p]));
    for (const r of m.rounds) {
      if (r.anomalous) continue;
      const c = comebackOf(m, info, r);
      if (Number.isFinite(c.minWp)) comebacks.push(c);
      for (const e of r.events) {
        const p = playOf(m, info, r, e, players);
        if (p) plays.push(p);
      }
    }
  }
  plays.sort((a, b) => b.wpa - a.wpa || byPlace(a, b));
  comebacks.sort((a, b) => a.minWp - b.minWp || byPlace(a, b));
  return { plays: plays.slice(0, n), comebacks: comebacks.slice(0, n) };
}

/** Top `n` jogadas por impacto (kill, plant ou desarme). */
export const topPlays = (matches: Match[], n = 10): PlayHighlight[] => computeHighlights(matches, n).plays;

/** Top `n` rounds em que o vencedor chegou à menor chance de vitória e mesmo assim ganhou. */
export const biggestComebacks = (matches: Match[], n = 10): ComebackHighlight[] => computeHighlights(matches, n).comebacks;

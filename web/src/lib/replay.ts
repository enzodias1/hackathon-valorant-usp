// Modelo de movimento do replay 2D (sem React; o componente analise/RoundReplay só desenha).
// A Riot registra a posição e a direção da mira de todos os vivos em cada kill, plant e desarme. Entre esses instantes o
// movimento é estimado: rota pelo chão do mapa (lib/navgrid) que evita as áreas vistas pelos inimigos quando dá tempo,
// ritmo de corrida, e saltos para o que é rápido demais para correr (habilidade, teleporte) ou anotado pela equipe.
import { toMinimap, type UV } from "./minimap";
import { findPath, visibleCells, type NavGrid } from "./navgrid";
import type { Color, MapTransform, Match, MatchPlayer, PosEntry, ReplayNote, Round, RoundEvent } from "./types";

export const RUN_MPS = 5.5; // ritmo estimado de deslocamento (correndo com rifle)
export const JUMP_MPS = 7.5; // acima disso não dá correndo (VALORANT: ~6,75 m/s com a faca): habilidade ou teleporte
const SEEN_RANGE_M = 45; // até onde um inimigo "vê" para a rota evitar (distância típica de duelo)
const SEEN_COST = 4; // passar por área vista pelo inimigo custa 4× na busca de caminho
const MAX_DETOUR = 3; // a rota que evita os inimigos pode ser até 3× a mais curta (ex.: voltar pela base), se der tempo de correr

export type Sample = { t: number; x: number; y: number; view: number | null };
/**
 * Trecho entre dois registros. walk: anda pelos corredores no ritmo de corrida no momento mais seguro: se a rota está
 * mais exposta aos inimigos no registro de chegada (eles estão chegando), sai logo e espera no destino; senão, segura a
 * posição e anda a tempo de chegar (o time segura ângulo e rotaciona/executa perto da hora). Saindo do spawn, sai na
 * queda da barreira. jump: rápido demais para correr (habilidade de movimento, teleporte) ou anotado pela equipe: fica no
 * ponto de partida e reaparece no destino no meio do intervalo.
 */
export type Leg = {
  t0: number; t1: number; kind: "walk" | "jump";
  pts: UV[]; cum: number[]; len: number; // caminho (uv) e comprimento acumulado
  start: number; depart: number; arrive: number; // walk: distância já percorrida ao sair (spawn), quando sai e quando chega
  view0: number | null; view1: number | null; // mira registrada (radianos, eixos do jogo)
  avoided?: boolean; // a rota desviou da visão dos inimigos
  early?: boolean; // saiu logo (a rota ficaria mais exposta perto da chegada)
  note?: ReplayNote; // anotação da equipe sobre este trecho
};
/** Tempo morto: da morte até reaparecer (ressurreição da Sage ou da Clove), ou até o fim do round (to null). */
export type DeadSpan = { from: number; to: number | null; xy: [number, number] };
export type Track = { p: MatchPlayer; samples: Sample[]; legs: Leg[]; dead: DeadSpan[] };
export type Pose = { at: UV; dir: number | null }; // dir: ângulo na tela, em radianos
export type RouteStats = { legs: number; avoided: number; extraM: number; early: number };

/** Direção do jogo (radianos, atan2(dy, dx)) -> ângulo na tela. Os eixos do minimapa são trocados (ver lib/minimap). */
export const screenDir = (view: number, tf: MapTransform) => Math.atan2(Math.cos(view) * tf.yMultiplier, Math.sin(view) * tf.xMultiplier);

const polyLen = (pts: UV[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.u - pts[i - 1].u, p.v - pts[i - 1].v) : 0), 0);

function makeLeg(t0: number, t1: number, pts: UV[], view0: number | null, view1: number | null, mPerUv: number, fromSpawn: boolean, early = fromSpawn): Leg {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v));
  const len = cum[cum.length - 1];
  const runMs = ((len * mPerUv) / RUN_MPS) * 1000;
  const move = Math.min(runMs, t1 - t0); // se não dá tempo no ritmo de corrida, anda mais rápido (até o limite do salto)
  const leg: Leg = early
    ? { t0, t1, kind: "walk", pts, cum, len, start: 0, depart: t0, arrive: t0 + move, view0, view1, early }
    : { t0, t1, kind: "walk", pts, cum, len, start: 0, depart: t1 - move, arrive: t1, view0, view1, early };
  if (fromSpawn && runMs > t1 - t0) leg.start = len * (1 - (t1 - t0) / runMs); // na queda da barreira já estava adiantado no spawn
  else if (!fromSpawn && (len * mPerUv) / Math.max((t1 - t0) / 1000, 0.001) > JUMP_MPS) leg.kind = "jump";
  return leg;
}

/** Posições de cada jogador no round (os vivos em cada evento + a vítima onde morreu) e os trechos entre elas. */
export function buildTracks(match: Match, round: Round, nav: NavGrid | null, stats?: RouteStats): Track[] {
  const tf = match.map.transform;
  const mPerUv = 1 / Math.abs(tf.xMultiplier) / 100;
  const idx = new Map(match.players.map((p, i) => [p.puuid, i]));
  const tracks: Track[] = match.players.map((p) => ({ p, samples: [], legs: [], dead: [] }));
  const posAt = new Map<number, PosEntry[]>(); // todos os vivos em cada instante registrado
  const deaths = new Map<number, { t: number; xy: [number, number] }[]>();
  const revives = new Map<number, number[]>(); // instante do registro em que cada um reaparece vivo
  for (const e of round.events) {
    for (const [i, x, y, view] of e.pos ?? []) tracks[i]?.samples.push({ t: e.t, x, y, view });
    if (e.pos?.length) posAt.set(e.t, [...(posAt.get(e.t) ?? []), ...e.pos]);
    for (const id of e.revived ?? []) {
      const i = idx.get(id);
      if (i !== undefined) revives.set(i, [...(revives.get(i) ?? []), e.t]);
    }
    const v = e.type === "kill" && e.victim ? idx.get(e.victim) : undefined;
    if (v !== undefined && e.victim_xy) {
      tracks[v].samples.push({ t: e.t, x: e.victim_xy[0], y: e.victim_xy[1], view: null });
      deaths.set(v, [...(deaths.get(v) ?? []), { t: e.t, xy: e.victim_xy }]);
    }
  }
  /** Último registro do round antes de t: a ressurreição aconteceu depois dele. */
  const prevRecord = (t: number) => round.events.reduce((m, e) => (e.t < t && e.t > m ? e.t : m), 0);

  // o que cada time enxerga em cada instante registrado (calculado uma vez e reaproveitado)
  const rangeCells = nav ? SEEN_RANGE_M / (mPerUv / nav.n) : 0;
  const seenCache = new Map<string, Uint8Array | null>();
  const seenBy = (t: number, color: Color) => {
    const key = `${t}:${color}`;
    if (!seenCache.has(key)) {
      const eyes = (posAt.get(t) ?? []).filter(([i]) => match.players[i]?.color === color).map(([, x, y]) => toMinimap([x, y], tf));
      seenCache.set(key, nav && eyes.length ? visibleCells(nav, eyes, rangeCells) : null);
    }
    return seenCache.get(key)!;
  };
  const enemyCost = (color: Color, times: number[]) => {
    if (!nav) return null;
    const maps = times.map((t) => seenBy(t, color === "Red" ? "Blue" : "Red")).filter((m): m is Uint8Array => !!m);
    if (!maps.length) return null;
    const cost = new Float32Array(nav.n * nav.n).fill(1);
    for (const m of maps) for (let i = 0; i < m.length; i++) if (m[i]) cost[i] = SEEN_COST;
    return cost;
  };
  /** Parte da rota (amostrada a cada ~0,5 célula) que um mapa de visão enxerga. */
  const exposure = (pts: UV[], seen: Uint8Array | null) => {
    if (!nav || !seen) return 0;
    let hit = 0, tot = 0;
    for (let i = 1; i < pts.length; i++) {
      const steps = Math.max(1, Math.ceil(Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v) * nav.n * 2));
      for (let k = 0; k < steps; k++) {
        const f = k / steps;
        const c = Math.min(nav.n - 1, Math.max(0, Math.floor((pts[i - 1].u + (pts[i].u - pts[i - 1].u) * f) * nav.n)));
        const r = Math.min(nav.n - 1, Math.max(0, Math.floor((pts[i - 1].v + (pts[i].v - pts[i - 1].v) * f) * nav.n)));
        hit += seen[r * nav.n + c]; tot++;
      }
    }
    return tot ? hit / tot : 0;
  };
  /** Rota mais curta; se der tempo de correr, a que evita a visão dos inimigos nos registros de saída e de chegada. */
  const route = (a: UV, b: UV, dtS: number, color: Color, times: number[]): { pts: UV[] | null; avoided: boolean } => {
    const short = nav ? findPath(nav, a, b) : [a, b];
    if (!short || !nav) return { pts: short, avoided: false };
    const shortM = polyLen(short) * mPerUv;
    if (shortM / Math.max(dtS, 0.001) > JUMP_MPS) return { pts: short, avoided: false }; // vai ser salto de qualquer jeito
    const cost = enemyCost(color, times);
    const safe = cost ? findPath(nav, a, b, cost) : null;
    if (!safe) return { pts: short, avoided: false };
    const safeM = polyLen(safe) * mPerUv;
    const ok = safeM <= Math.max(shortM, RUN_MPS * dtS) && safeM <= MAX_DETOUR * shortM;
    if (stats && ok && safeM > shortM + 1) { stats.avoided++; stats.extraM += safeM - shortM; }
    return ok ? { pts: safe, avoided: safeM > shortM + 1 } : { pts: short, avoided: false };
  };

  for (const tr of tracks) {
    const s = tr.samples.sort((a, b) => a.t - b.t);
    if (!s.length) continue;
    const at = (x: Sample) => toMinimap([x.x, x.y], tf);
    // antes do primeiro registro: sai do spawn do seu lado na queda da barreira
    const spawn = nav?.spawn[round.attacker === tr.p.color ? "atk" : "def"];
    if (spawn && s[0].t > 0) {
      const { pts, avoided } = route(spawn, at(s[0]), s[0].t / 1000, tr.p.color, [s[0].t]);
      if (pts) tr.legs.push({ ...makeLeg(0, s[0].t, pts, null, s[0].view, mPerUv, true), avoided });
    }
    const backAt = revives.get(tracks.indexOf(tr)) ?? [];
    for (let k = 0; k + 1 < s.length; k++) {
      const a = s[k], b = s[k + 1];
      if (b.t <= a.t) continue;
      // volta de uma ressurreição: renasce onde morreu (Sage e Clove revivem no lugar do corpo), depois do registro anterior
      const back = backAt.includes(b.t);
      const t0 = back ? Math.max(a.t, prevRecord(b.t)) : a.t;
      const { pts, avoided } = route(at(a), at(b), (b.t - t0) / 1000, tr.p.color, [t0, b.t]);
      // sai logo se a rota estiver mais exposta aos inimigos na chegada do que na saída (eles estão vindo)
      const enemy: Color = tr.p.color === "Red" ? "Blue" : "Red";
      const early = !back && !!pts && exposure(pts, seenBy(b.t, enemy)) > exposure(pts, seenBy(t0, enemy)) + 0.1;
      if (stats && early) stats.early++;
      const leg = { ...makeLeg(t0, b.t, pts ?? [at(a), at(b)], a.view, b.view, mPerUv, false, early), avoided };
      if (!pts) leg.kind = "jump"; // um dos pontos fora do chão (ex.: arena da ultimate da Iso)
      tr.legs.push(leg);
      if (stats) stats.legs++;
    }
    // tempo morto: de cada morte até reaparecer (quando começa a andar de volta, o mais tarde possível) ou até o fim
    for (const d of deaths.get(tracks.indexOf(tr)) ?? []) {
      const r = backAt.filter((x) => x > d.t).sort((x, y) => x - y)[0];
      const leg = r === undefined ? undefined : tr.legs.find((l) => l.t1 === r && l.t0 >= d.t);
      tr.dead.push({ from: d.t, to: r === undefined ? null : leg ? (leg.kind === "jump" ? leg.t0 : leg.depart) : r, xy: d.xy });
    }
  }
  // anotações da equipe: o trecho vira salto, com o rótulo da anotação
  for (const nt of round.notes ?? []) {
    for (const leg of tracks[nt.player]?.legs ?? []) {
      if (leg.t0 >= nt.from - 600 && leg.t1 <= nt.to + 600) {
        leg.kind = "jump";
        leg.note = nt;
      }
    }
  }
  return tracks;
}

/** O tempo morto que contém t, se o jogador estiver morto nesse instante. */
export const deadAt = (tr: Track, t: number) => tr.dead.find((d) => t >= d.from && (d.to === null || t < d.to)) ?? null;
export const isDead = (tr: Track, t: number) => deadAt(tr, t) !== null;

/** Ponto do caminho a uma distância d do início, e a direção do trecho (ângulo na tela). */
function along(leg: Leg, d: number): Pose {
  let i = 1;
  while (i < leg.pts.length - 1 && leg.cum[i] < d) i++;
  const a = leg.pts[i - 1], b = leg.pts[i];
  const seg = leg.cum[i] - leg.cum[i - 1];
  const f = seg > 0 ? Math.min(1, Math.max(0, (d - leg.cum[i - 1]) / seg)) : 1;
  return { at: { u: a.u + (b.u - a.u) * f, v: a.v + (b.v - a.v) * f }, dir: Math.atan2(b.v - a.v, b.u - a.u) };
}

function lastView(s: Sample[], k: number) {
  for (let j = k; j >= 0; j--) if (s[j].view !== null) return s[j].view;
  return null;
}

export function poseAt(tr: Track, t: number, smooth: boolean, tf: MapTransform): Pose | null {
  const s = tr.samples;
  if (!s.length) return null;
  const snap = (k: number): Pose => {
    const v = lastView(s, k);
    return { at: toMinimap([s[k].x, s[k].y], tf), dir: v === null ? null : screenDir(v, tf) };
  };
  if (!smooth) {
    let k = 0;
    while (k + 1 < s.length && s[k + 1].t <= t) k++;
    return snap(k);
  }
  const leg = tr.legs.find((l) => t >= l.t0 && t < l.t1);
  if (!leg) {
    if (t < s[0].t) return snap(0);
    let k = 0;
    while (k + 1 < s.length && s[k + 1].t <= t) k++;
    return snap(k);
  }
  const v0 = leg.view0 === null ? null : screenDir(leg.view0, tf);
  const v1 = leg.view1 === null ? null : screenDir(leg.view1, tf);
  if (leg.kind === "jump") {
    const second = t >= (leg.t0 + leg.t1) / 2;
    return { at: second ? leg.pts[leg.pts.length - 1] : leg.pts[0], dir: second ? v1 ?? v0 : v0 };
  }
  if (t < leg.depart) return { at: leg.pts[0], dir: v0 ?? along(leg, 0).dir }; // ainda segurando a posição
  if (t >= leg.arrive) return { at: leg.pts[leg.pts.length - 1], dir: v1 ?? along(leg, leg.len).dir }; // chegou: espera mirando
  const f = (t - leg.depart) / Math.max(leg.arrive - leg.depart, 1);
  return along(leg, leg.start + (leg.len - leg.start) * f); // andando: olha para onde vai
}

/** Chance de vitória do time vermelho no instante t: salto em cada evento e, entre eles, só o relógio (rampa). */
export function wpAt(round: Round, t: number, end: number) {
  let t0 = 0;
  let w0 = round.wp_red_start;
  for (const e of round.events) {
    if (e.after_round_end) continue;
    if (e.t > t) return w0 + (e.wp_red_before - w0) * ((t - t0) / Math.max(e.t - t0, 1));
    t0 = e.t;
    w0 = e.wp_red_after;
  }
  const fin = round.winner === "Red" ? 1 : 0;
  if (t >= end) return fin;
  return w0 + (fin - w0) * ((t - t0) / Math.max(end - t0, 1));
}

/** Aliado vivo mais próximo de quem morreu, no instante da morte (em metros; 100 unidades do jogo ≈ 1 m). */
export function nearestAlly(e: RoundEvent, match: Match, victim: MatchPlayer) {
  let best: { at: UV; m: number; p: MatchPlayer } | null = null;
  for (const [i, x, y] of e.pos ?? []) {
    const p = match.players[i];
    if (!p || p.color !== victim.color || p.puuid === victim.puuid || !e.victim_xy) continue;
    const m = Math.hypot(x - e.victim_xy[0], y - e.victim_xy[1]) / 100;
    if (!best || m < best.m) best = { at: toMinimap([x, y], match.map.transform), m, p };
  }
  return best;
}

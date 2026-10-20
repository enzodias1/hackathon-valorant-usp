// Geometria do minimapa: posição do jogo -> plano unificado 0–1 da imagem (u = horizontal, v = vertical).
// Sem React: serve para o minimapa do round, para o mapa de calor das zonas e para Server Components.
import type { MapTransform, Round } from "./types";

export type UV = { u: number; v: number };

/**
 * Posição do jogo `[x, y]` (~1 cm por unidade) -> fração da imagem do minimapa (0–1).
 * Os eixos são TROCADOS: o `y` do jogo vira a horizontal e o `x` vira a vertical (ver web/DADOS.md).
 */
export function toMinimap(xy: readonly [number, number], t: MapTransform): UV {
  const [x, y] = xy;
  return { u: y * t.xMultiplier + t.xScalarToAdd, v: x * t.yMultiplier + t.yScalarToAdd };
}

/** O ponto cai dentro da imagem? (útil para descartar posições com erro) */
export const insideMinimap = ({ u, v }: UV) => u >= 0 && u <= 1 && v >= 0 && v <= 1;

/** Tempo da spike depois de plantada e duração do round sem plant (ms). */
export const SPIKE_TIMER_MS = 45_000;
export const ROUND_TIMER_MS = 100_000;

/**
 * Instante em que o round terminou (ms desde o início do round).
 * Eventos depois disso vêm com `after_round_end: true`.
 */
export function roundEndMs(round: Round): number {
  const lastLive = round.events.reduce((m, e) => (e.after_round_end ? m : Math.max(m, e.t)), 0);
  switch (round.result) {
    case "Defuse":
      return round.defuse?.t ?? lastLive;
    case "Detonate":
      return round.plant ? round.plant.t + SPIKE_TIMER_MS : lastLive;
    case "Timer":
      return Math.max(lastLive, ROUND_TIMER_MS);
    default:
      return lastLive;
  }
}

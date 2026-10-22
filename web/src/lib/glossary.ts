// O que os números do site significam, em uma frase cada. Aparecem no botão "i" dos lugares onde cada número é mostrado.
// Os limites (5 s, 30 m, 80%, 20%) e a taxa de trade por distância vêm do modelo (model.json), não são escritos à mão.
import { pct } from "./format";
import type { ModelInfo } from "./types";

/** [termo, definição] */
export type Term = [string, string];

/** Fora do glossário porque o replay (no navegador, sem o model.json) também usa: impacto não depende do modelo, e a virada
 *  usa o limite do resumo do round. */
export const impactTerm: Term = ["Impacto", "quanto uma jogada mudou a chance de o time vencer o round. Uma kill num round já decidido vale quase nada."];
export const comebackTerm = (wp: number): Term => ["Virada", `o time esteve com ${pct(wp)} ou menos de chance de vitória e venceu.`];

export function glossary(model: ModelInfo) {
  const d = model.definitions;
  const far = model.trade_by_distance.filter((t) => parseInt(t.distance, 10) >= d.isolated_distance_m);
  const farRate = far.reduce((s, t) => s + t.trade_rate * t.n, 0) / Math.max(far.reduce((s, t) => s + t.n, 0), 1);
  const near = model.trade_by_distance[0];
  return {
    impact: impactTerm,
    impactPerRound: ["Impacto por round", "a média do impacto das jogadas do jogador por round jogado. Mede o quanto ele decide rounds, não quantas kills faz."],
    trade: ["Trade", `vingar a morte de um aliado em até ${d.trade_window_s} segundos.`],
    isolated: ["Morte isolada", `morrer com o aliado mais próximo a mais de ${d.isolated_distance_m} m. Quase nunca dá para trocar: só ${pct(farRate)} dessas mortes são vingadas (com o aliado a até ${parseInt(near.distance.split("–")[1], 10)} m, ${pct(near.trade_rate)}).`],
    throw: ["Round jogado fora", `o time chegou a ${pct(d.throw_wp)} ou mais de chance de vitória e perdeu.`],
    comeback: comebackTerm(d.comeback_wp),
    strength: ["Força", "a chance de vencer um round contra um time médio do campeonato, descontando a economia. É a ordem do ranking de times."],
  } satisfies Record<string, Term>;
}

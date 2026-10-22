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

/** Tipos de compra do time (pipeline/etl.py, buy_type). Pelo valor somado do equipamento dos 5 jogadores no início do round. */
export const BUY_BASIS =
  "O tipo de compra sai do valor do equipamento dos 5 jogadores no início do round, somado: armas, colete e habilidades, incluindo o que sobrou do round anterior.";
const BUY_TYPES = [
  { name: "Eco", range: "menos de 5 mil", per: "até ~1 mil por jogador", tag: "só pistola",
    what: "quase só a pistola grátis, guardando dinheiro para o round seguinte" },
  { name: "Semi-eco", range: "5 a 10 mil", per: "~1 a 2 mil por jogador", tag: "pistola melhor ou SMG",
    what: "pistola melhor ou SMG, colete leve e algumas habilidades" },
  { name: "Semi-buy", range: "10 a 20 mil", per: "~2 a 4 mil por jogador", tag: "compra incompleta",
    what: "compra incompleta, como SMG ou rifle sem colete pesado, ou só parte do time com rifle" },
  { name: "Full buy", range: "20 mil ou mais", per: "~4 mil por jogador", tag: "rifle e colete pesado",
    what: "rifle ou Operator, colete pesado e habilidades para todos" },
];
const PISTOL: Term = ["Pistol", "os rounds 1 e 13, em que todo mundo começa com 800 créditos."];
/** Versão completa (metodologia). */
export const BUY_TERMS: Term[] = [PISTOL, ...BUY_TYPES.map((b): Term => [b.name, `${b.range} no total (${b.per}): ${b.what}.`])];
/** Versão de uma linha, ao lado da tabela de compras do time. */
export const BUY_LEGEND = `Pelo equipamento dos 5 jogadores no início do round (armas, colete e habilidades): ${
  BUY_TYPES.map((b) => `${b.name}, ${b.range} (${b.tag})`).join(" · ")}. Pistol: rounds 1 e 13.`;

/** Decisões sem dinheiro para full buy (pipeline/economy.py): pela parcela do dinheiro disponível que o time gastou. */
export const DECISION_LEGEND = "Pela parcela do dinheiro disponível que o time gastou: Economizar, até 35% · Meio-termo, entre 35% e 65% · Forçar, 65% ou mais.";

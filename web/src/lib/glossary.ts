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

/** Tipos de compra do time, como no jogo (pipeline/etl.py, classify_buys): pelo que cada jogador comprou e pelo dinheiro que
 *  o time guardou. Kit completo = Vandal/Phantom (2.900) + escudo cheio (1.000); a derrota paga 1.900, 2.400 ou 2.900 conforme a
 *  sequência. Só a metodologia explica: na aba de economia do time, os tipos aparecem sem definição (os jogadores conhecem). */
export const BUY_BASIS =
  "O tipo de compra sai do que cada jogador comprou e do dinheiro que o time guardou. “Garantir o full buy seguinte” quer dizer que, mesmo perdendo o round, pelo menos 4 jogadores teriam os 3.900 créditos de Vandal ou Phantom e escudo cheio no próximo: a derrota paga 1.900, 2.400 ou 2.900, conforme a sequência de derrotas.";
export const BUY_TERMS: Term[] = [
  ["Pistol", "os rounds 1 e 13, em que todo mundo começa com 800 créditos."],
  ["Eco", "o time gasta pouco ou nada (Classic, às vezes Sheriff ou Ghost e escudo leve) para garantir o full buy do round seguinte."],
  ["Meia compra", "compra intermediária (Spectre, Stinger ou Bulldog com escudo leve, ou só parte do time com Vandal ou Phantom) que guarda o dinheiro do full buy do round seguinte. Também é a compra do round depois de vencer o pistol."],
  ["Forçado", "o time gasta o dinheiro sem ter o suficiente para o full buy e, se perder, não terá o full buy no round seguinte. Comum para quebrar a sequência do adversário e no último round de cada metade."],
  ["Full buy", "arma principal e escudo cheio para o time: quase sempre Vandal ou Phantom (3.900 créditos por jogador com o escudo, fora as habilidades), às vezes Odin ou Operator."],
];

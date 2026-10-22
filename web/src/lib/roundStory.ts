// "O que decidiu o round": até 3 frases geradas a partir dos eventos e da chance de vitória (sem texto escrito à mão).
// Regras, em ordem: virada (o vencedor chegou a ≤ 20%) ou vitória contra a economia; multi-kill (3+) do time que venceu;
// clutch; ressurreição no time que venceu; desarme no limite; e a jogada que mais aumentou a chance do time que venceu, se
// ainda não foi citada.
import { chance, nick, pct, pp } from "./format";
import type { Color, Match, MatchPlayer, Round, RoundEvent } from "./types";

const MULTI: Record<number, string> = { 3: "um triple kill", 4: "um quadra kill", 5: "um ace" };
export const COMEBACK_WP = 0.2; // o mesmo de model.json (definitions.comeback_wp)
const UNDERDOG_WP = 0.35;
const SPIKE_MS = 45_000;

/** Duração por extenso: "331 milésimos de segundo", "1,4 segundo", "12 segundos". */
export function dur(ms: number) {
  if (ms < 1000) {
    const n = Math.max(1, Math.round(ms));
    return `${n} ${n === 1 ? "milésimo" : "milésimos"} de segundo`;
  }
  const s = Number((ms / 1000).toFixed(ms < 10_000 ? 1 : 0));
  return `${s.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${s < 2 ? "segundo" : "segundos"}`;
}

/** O que a jogada fez, em minúsculas: "matou X", "plantou a spike", "desarmou a spike", "reviveu X com a ultimate" ou, na
 *  Clove, "voltou ao round com a própria ultimate". */
export function playVerb(e: RoundEvent, players: MatchPlayer[], withWeapon = false) {
  const name = (id?: string | null) => nick(players.find((p) => p.puuid === id)?.name);
  if (e.type === "plant") return "plantou a spike";
  if (e.type === "defuse") return "desarmou a spike";
  if (e.type === "revive") return e.actor === e.target ? "voltou ao round com a própria ultimate" : `reviveu ${name(e.target)} com a ultimate`;
  return `matou ${name(e.victim)}${withWeapon && e.weapon ? ` (${e.weapon})` : ""}`;
}

export function roundStory(match: Match, round: Round): string[] {
  const P = new Map(match.players.map((p) => [p.puuid, p]));
  const who = (id: string | null | undefined) => {
    const p = id ? P.get(id) : undefined;
    return p ? `${nick(p.name)} (${p.agent})` : "?";
  };
  const W: Color = round.winner;
  const L: Color = W === "Red" ? "Blue" : "Red";
  const tn = (c: Color) => match.teams[c].name;
  const wpW = (wpRed: number) => (W === "Red" ? wpRed : 1 - wpRed);
  const live = round.events.filter((e) => !e.after_round_end);

  // estado depois de cada evento: chance do vencedor, vivos de cada lado, spike plantada
  const alive: Record<Color, Set<string>> = {
    Red: new Set(match.players.filter((p) => p.color === "Red").map((p) => p.puuid)),
    Blue: new Set(match.players.filter((p) => p.color === "Blue").map((p) => p.puuid)),
  };
  type State = { t: number; wp: number; w: number; l: number; planted: boolean; aliveW: string[] };
  const states: State[] = [{ t: 0, wp: wpW(round.wp_red_start), w: 5, l: 5, planted: false, aliveW: [...alive[W]] }];
  for (const e of live) {
    if (e.type === "revive" && e.target) { // ressurreição: volta a contar como vivo
      const c = P.get(e.target)?.color;
      if (c) alive[c].add(e.target);
    }
    if (e.type === "kill" && e.victim) {
      const c = P.get(e.victim)?.color;
      if (c) alive[c].delete(e.victim);
    }
    states.push({ t: e.t, wp: wpW(e.wp_red_after), w: alive[W].size, l: alive[L].size,
                  planted: !!round.plant && e.t >= round.plant.t, aliveW: [...alive[W]] });
  }

  const out: string[] = [];
  const mentioned = new Set<RoundEvent>();

  // 1. virada ou vitória contra a economia (ou só o resultado)
  const worst = states.reduce((a, b) => (b.wp < a.wp ? b : a));
  if (worst.wp <= COMEBACK_WP && worst.w === 0 && round.plant) {
    // o vencedor já não tinha ninguém vivo: ganhou porque a spike explodiu antes do desarme
    const left = round.plant.t + SPIKE_MS - worst.t;
    const margin = live.find((e) => e.defuse_margin !== undefined && e.t <= worst.t)?.defuse_margin;
    const time = margin === undefined ? "" : margin >= 0 ? `, tempo para chegar e desarmar com ${dur(margin * 1000)} de sobra`
      : `, sem tempo para chegar e desarmar (faltavam ${dur(-margin * 1000)})`;
    out.push(`${tn(W)} venceu sem ninguém vivo: ${tn(L)} ficou ${worst.l} contra 0 com ${dur(left)} de spike${time} `
      + `(${chance(1 - worst.wp)} de chance), mas a spike explodiu.`);
  } else if (worst.wp <= COMEBACK_WP) {
    // com a spike plantada, o tempo dela explica boa parte da chance (4 contra 2 com 14 s não é o mesmo que com 45 s)
    const left = worst.planted && round.plant ? round.plant.t + SPIKE_MS - worst.t : null;
    const alive = `${worst.l} ${worst.l === 1 ? "vivo" : "vivos"} contra ${worst.w}`;
    const situation = left === null ? alive
      : round.attacker === L ? `${alive}, a spike plantada e ${dur(left)} para ela explodir`
      : `${alive} e ${dur(left)} para desarmar a spike`;
    out.push(`${tn(W)} venceu de virada: ${tn(L)} chegou a ${chance(1 - worst.wp)} de chance, com ${situation}.`);
  } else if (states[0].wp <= UNDERDOG_WP) {
    out.push(`${tn(W)} venceu mesmo começando com só ${pct(states[0].wp)} de chance pela economia (${round.buy[W]} contra ${round.buy[L]}).`);
  } else {
    const how = { Elimination: "eliminando o time adversário", Defuse: "desarmando a spike",
                  Detonate: `com a explosão da spike${round.plant?.site ? ` no ${round.plant.site}` : ""}`, Timer: "segurando até o tempo acabar" }[round.result];
    out.push(`${tn(W)} venceu ${how}.`);
  }

  // 2. multi-kill
  const killsBy = new Map<string, RoundEvent[]>();
  for (const e of live) {
    if (e.type === "kill" && e.actor && !e.teamkill && P.get(e.actor)?.color === W) killsBy.set(e.actor, [...(killsBy.get(e.actor) ?? []), e]);
  }
  const [mkActor, mk] = [...killsBy.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [null, []];
  if (mkActor && mk.length >= 3) {
    const span = mk[mk.length - 1].t - mk[0].t;
    out.push(`${who(mkActor)} fez ${MULTI[Math.min(mk.length, 5)]}${span <= 15_000 ? ` em ${dur(span)}` : ""}.`);
    mk.forEach((e) => mentioned.add(e));
  }

  // 3. clutch: o vencedor ficou com 1 contra 2 ou mais (não conta se alguém do time voltou depois: não venceu sozinho)
  const backEv = live.find((e) => e.type === "revive" && P.get(e.target ?? "")?.color === W);
  const clutch = states.find((s) => s.w === 1 && s.l >= 2);
  if (clutch && !(backEv && backEv.t > clutch.t)) out.push(`${who(clutch.aliveW[0])} venceu um 1 contra ${clutch.l}.`);

  // 3b. ressurreição no time que venceu (ultimate da Sage ou da Clove): explica um jogador "morto" que volta a jogar
  if (backEv) {
    out.push(backEv.actor === backEv.target ? `${who(backEv.target)} voltou ao round com a própria ultimate.`
      : `${who(backEv.actor)} reviveu ${who(backEv.target)} com a ultimate.`);
    mentioned.add(backEv);
  }

  // 4. desarme no limite
  const defuse = live.find((e) => e.type === "defuse");
  if (defuse && round.plant) {
    const left = round.plant.t + SPIKE_MS - defuse.t;
    const death = round.events.find((e) => e.after_round_end && e.type === "kill" && e.victim === defuse.actor && e.t - defuse.t <= 1500);
    const bits = [left <= 7_000 ? `faltando ${dur(left)} para a explosão` : "", death ? `${dur(death.t - defuse.t)} antes de morrer` : ""].filter(Boolean);
    if (bits.length) {
      out.push(`${who(defuse.actor)} desarmou a spike ${bits.join(" e ")}.`);
      mentioned.add(defuse);
    }
  }

  // 5. a jogada que mais aumentou a chance do time que venceu, se ainda não apareceu (a do perdedor não decidiu o round)
  const top = live.filter((e) => e.actor && !e.teamkill && P.get(e.actor)?.color === W && e.wpa > 0).sort((a, b) => b.wpa - a.wpa)[0];
  if (top && !mentioned.has(top)) {
    const what = playVerb(top, match.players);
    out.push(`Jogada que mais pesou para a vitória: ${who(top.actor)} ${what} (${pp(top.wpa)} de chance).`);
  }
  return out.slice(0, 3);
}

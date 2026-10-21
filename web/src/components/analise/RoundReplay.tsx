"use client";
// Replay 2D do round. Evolução do minimapa do Nukan: reaproveita MinimapBase e toMinimap.
// A Riot registra a posição e a direção da mira de todos os vivos em cada kill, plant e desarme. O replay mostra esses
// instantes e, entre eles, estima o movimento pelos corredores do mapa (lib/navgrid; avisado na tela). Deslocamentos
// rápidos demais para correr viram "salto" (habilidade de movimento ou teleporte). Junto vêm a chance de vitória ao vivo,
// a sequência do round com o impacto de cada jogada e, em cada morte, a distância do aliado mais próximo.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Color, MapTransform, Match, MatchPlayer, ReplayNote, Round, RoundEvent } from "@/lib/types";
import { clock, nick, pct, pp } from "@/lib/format";
import { roundEndMs, SPIKE_TIMER_MS, toMinimap, type UV } from "@/lib/minimap";
import { decodeNavGrid, findPath, type NavGrid, type NavGridRaw } from "@/lib/navgrid";
import MinimapBase from "@/components/MinimapBase";

const TEAM_VAR: Record<Color, string> = { Red: "var(--team-red)", Blue: "var(--team-blue)" };
const SPEEDS = [1, 2, 4];
const ISOLATED_M = 30; // mesma régua de "morte isolada" do resto do site
const SHOT_MS = 1600; // tempo (do round) em que a linha do tiro fica na tela
const FOCUS_MS = 4000; // e a análise da morte (aliado mais próximo)
const SWING_MS = 2500; // e o "+X pp" da última jogada ao lado da chance de vitória
const CONE_HALF = (28 * Math.PI) / 180;
const CONE_LEN = 0.075;
const R = 0.019; // raio do ícone do jogador, em fração do mapa

type Sample = { t: number; x: number; y: number; view: number | null };
/**
 * Trecho entre dois registros. walk: segura a posição e anda pelos corredores no ritmo de corrida a tempo de chegar no
 * próximo registro (no meio do round o time segura ângulo e só rotaciona/executa perto da hora); saindo do spawn é o
 * contrário: sai na queda da barreira e espera no destino. jump: rápido demais para correr (habilidade de movimento,
 * teleporte) ou anotado pela equipe: fica no ponto de partida e reaparece no destino no meio do intervalo, com o trajeto
 * tracejado na tela.
 */
type Leg = {
  t0: number; t1: number; kind: "walk" | "jump";
  pts: UV[]; cum: number[]; len: number; // caminho (uv) e comprimento acumulado
  start: number; depart: number; arrive: number; // walk: distância já percorrida ao sair (spawn), quando sai e quando chega
  view0: number | null; view1: number | null; // mira registrada (radianos, eixos do jogo)
  note?: ReplayNote; // anotação da equipe sobre este trecho
};
type Track = { p: MatchPlayer; samples: Sample[]; legs: Leg[]; deathT: number | null; deathXY: [number, number] | null };
type Pose = { at: UV; dir: number | null }; // dir: ângulo na tela, em radianos

const RUN_MPS = 5.5; // ritmo estimado de deslocamento (correndo com rifle)
const JUMP_MPS = 7.5; // acima disso não dá correndo (VALORANT: ~6,75 m/s com a faca): habilidade ou teleporte

/** Direção do jogo (radianos, atan2(dy, dx)) -> ângulo na tela. Os eixos do minimapa são trocados (ver lib/minimap). */
const screenDir = (view: number, tf: MapTransform) => Math.atan2(Math.cos(view) * tf.yMultiplier, Math.sin(view) * tf.xMultiplier);

function makeLeg(t0: number, t1: number, pts: UV[], view0: number | null, view1: number | null, mPerUv: number, fromSpawn: boolean): Leg {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v));
  const len = cum[cum.length - 1];
  const runMs = ((len * mPerUv) / RUN_MPS) * 1000;
  const move = Math.min(runMs, t1 - t0); // se não dá tempo no ritmo de corrida, anda mais rápido (até o limite do salto)
  const leg: Leg = fromSpawn
    ? { t0, t1, kind: "walk", pts, cum, len, start: 0, depart: t0, arrive: t0 + move, view0, view1 }
    : { t0, t1, kind: "walk", pts, cum, len, start: 0, depart: t1 - move, arrive: t1, view0, view1 };
  if (fromSpawn && runMs > t1 - t0) leg.start = len * (1 - (t1 - t0) / runMs); // na queda da barreira já estava adiantado no spawn
  else if (!fromSpawn && (len * mPerUv) / Math.max((t1 - t0) / 1000, 0.001) > JUMP_MPS) leg.kind = "jump";
  return leg;
}

/** Posições de cada jogador no round (os vivos em cada evento + a vítima onde morreu) e os trechos entre elas. */
function buildTracks(match: Match, round: Round, nav: NavGrid | null): Track[] {
  const tf = match.map.transform;
  const mPerUv = 1 / Math.abs(tf.xMultiplier) / 100;
  const idx = new Map(match.players.map((p, i) => [p.puuid, i]));
  const tracks: Track[] = match.players.map((p) => ({ p, samples: [], legs: [], deathT: null, deathXY: null }));
  for (const e of round.events) {
    for (const [i, x, y, view] of e.pos ?? []) tracks[i]?.samples.push({ t: e.t, x, y, view });
    const v = e.type === "kill" && e.victim ? idx.get(e.victim) : undefined;
    if (v !== undefined && e.victim_xy) {
      tracks[v].samples.push({ t: e.t, x: e.victim_xy[0], y: e.victim_xy[1], view: null });
      tracks[v].deathT = e.t; // a última morte vale (revive da Sage: volta a ter posições depois)
      tracks[v].deathXY = e.victim_xy;
    }
  }
  for (const tr of tracks) {
    const s = tr.samples.sort((a, b) => a.t - b.t);
    if (!s.length) continue;
    const at = (x: Sample) => toMinimap([x.x, x.y], tf);
    const path = (a: UV, b: UV) => (nav ? findPath(nav, a, b) : [a, b]);
    // antes do primeiro registro: sai do spawn do seu lado na queda da barreira
    const spawn = nav?.spawn[round.attacker === tr.p.color ? "atk" : "def"];
    if (spawn && s[0].t > 0) {
      const pts = path(spawn, at(s[0]));
      if (pts) tr.legs.push(makeLeg(0, s[0].t, pts, null, s[0].view, mPerUv, true));
    }
    for (let k = 0; k + 1 < s.length; k++) {
      const a = s[k], b = s[k + 1];
      if (b.t <= a.t) continue;
      const pts = path(at(a), at(b));
      const leg = makeLeg(a.t, b.t, pts ?? [at(a), at(b)], a.view, b.view, mPerUv, false);
      if (!pts) leg.kind = "jump"; // um dos pontos fora do chão (ex.: arena da ultimate da Iso)
      tr.legs.push(leg);
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

const isDead = (tr: Track, t: number) => tr.deathT !== null && t >= tr.deathT && !tr.samples.some((s) => s.t > tr.deathT!);

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

function poseAt(tr: Track, t: number, smooth: boolean, tf: MapTransform): Pose | null {
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
function wpAt(round: Round, t: number, end: number) {
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
function nearestAlly(e: RoundEvent, match: Match, victim: MatchPlayer) {
  let best: { at: UV; m: number; p: MatchPlayer } | null = null;
  for (const [i, x, y] of e.pos ?? []) {
    const p = match.players[i];
    if (!p || p.color !== victim.color || p.puuid === victim.puuid || !e.victim_xy) continue;
    const m = Math.hypot(x - e.victim_xy[0], y - e.victim_xy[1]) / 100;
    if (!best || m < best.m) best = { at: toMinimap([x, y], match.map.transform), m, p };
  }
  return best;
}

export default function RoundReplay({ match, round, initialT, nav }: { match: Match; round: Round; initialT?: number; nav?: NavGridRaw | null }) {
  const grid = useMemo(() => (nav ? decodeNavGrid(nav) : null), [nav]);
  // a key reinicia o estado (tempo, play) quando o round muda
  return <Replay key={`${match.id}:${round.n}:${initialT ?? ""}`} match={match} round={round} initialT={initialT} nav={grid} />;
}

function Replay({ match, round, initialT, nav }: { match: Match; round: Round; initialT?: number; nav: NavGrid | null }) {
  const tf = match.map.transform;
  const byId = useMemo(() => new Map(match.players.map((p) => [p.puuid, p])), [match]);
  const tracks = useMemo(() => buildTracks(match, round, nav), [match, round, nav]);
  const end = useMemo(() => roundEndMs(round), [round]);
  const maxT = useMemo(() => Math.ceil(Math.max(end, 1000, ...round.events.map((e) => e.t)) / 1000) * 1000, [end, round]);
  const decisive = useMemo(() => {
    let best = -1;
    round.events.forEach((e, i) => {
      if (!e.after_round_end && e.actor && (best < 0 || Math.abs(e.wpa) > Math.abs(round.events[best].wpa))) best = i;
    });
    return best;
  }, [round]);

  const [t, setT] = useState(() => Math.min(initialT ?? 0, maxT));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [smooth, setSmooth] = useState(true);
  const [focus, setFocus] = useState<number | null>(null); // jogador selecionado (índice em match.players): mostra o caminho dele
  const [copied, setCopied] = useState(false);
  const clipId = `replay-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) * speed;
      last = now;
      setT((prev) => Math.min(prev + dt, maxT));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, maxT]);

  useEffect(() => {
    if (playing && t >= maxT) setPlaying(false);
  }, [playing, t, maxT]);

  let cur = -1;
  round.events.forEach((e, i) => {
    if (e.t <= t) cur = i;
  });

  // mantém a jogada atual visível na lista, sem rolar a página
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-i="${cur}"]`);
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop || el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: el.offsetTop - list.clientHeight / 3, behavior: "smooth" });
    }
  }, [cur]);

  const seek = (ms: number) => {
    setPlaying(false);
    setT(ms);
  };
  const togglePlay = () => {
    if (!playing && t >= maxT) setT(0);
    setPlaying((p) => !p);
  };

  // instantes com posição registrada pela Riot (kill, plant, desarme)
  const regTimes = round.events.filter((e) => e.pos?.length).map((e) => e.t);
  const lastReg = regTimes.filter((x) => x <= t).pop();
  const nextReg = regTimes.find((x) => x > t);
  const registered = lastReg !== undefined && t - lastReg < 400;

  const eventTimes = round.events.map((e) => e.t);
  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.target instanceof HTMLInputElement) return; // o slider cuida das próprias setas
    if (ev.key === " " && ev.target instanceof HTMLButtonElement) return; // espaço num botão já é o clique dele
    if (ev.key === " ") {
      ev.preventDefault();
      togglePlay();
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      const to = ev.key === "ArrowRight" ? eventTimes.find((x) => x > t + 50) : eventTimes.filter((x) => x < t - 50).pop();
      seek(to ?? (ev.key === "ArrowRight" ? maxT : 0));
    }
  };
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#round-${round.n}@${(t / 1000).toFixed(1)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.hash = `round-${round.n}@${(t / 1000).toFixed(1)}`; // sem permissão de área de transferência: o link fica na barra
    }
  };

  const wp = wpAt(round, t, end);
  const poses = tracks.map((tr) => ({ tr, dead: isDead(tr, t), pose: poseAt(tr, t, smooth, tf) }));
  // caminho do jogador selecionado até agora (amostrado a cada 0,25 s)
  let trail: UV[] | null = null;
  if (focus !== null && tracks[focus]) {
    const tr = tracks[focus];
    const until = tr.deathT !== null && isDead(tr, t) ? tr.deathT : t;
    trail = [];
    for (let x = 0; x < until; x += 250) {
      const q = poseAt(tr, x, smooth, tf);
      if (q) trail.push(q.at);
    }
    const q = poseAt(tr, until, smooth, tf);
    if (q) trail.push(q.at);
  }
  const pick = (i: number) => setFocus((f) => (f === i ? null : i));
  // saltos em andamento (habilidade de movimento / teleporte): trajeto tracejado
  const jumps = smooth ? poses.flatMap(({ tr, dead }) => (dead ? [] : tr.legs.filter((l) => l.kind === "jump" && t >= l.t0 && t < l.t1))) : [];
  const kills = round.events.filter((e) => e.type === "kill" && e.t <= t);
  const shots = kills.filter((e) => t - e.t < SHOT_MS && e.killer_xy && e.victim_xy);
  const focusEvent = [...kills].reverse().find((e) => t - e.t < FOCUS_MS && !e.after_round_end && e.victim);
  const focusVictim = focusEvent?.victim ? byId.get(focusEvent.victim) : undefined;
  const ally = focusEvent && focusVictim ? nearestAlly(focusEvent, match, focusVictim) : null;
  const focusAt = focusEvent?.victim_xy ? toMinimap(focusEvent.victim_xy, tf) : null;
  const swing = cur >= 0 && !round.events[cur].after_round_end && t - round.events[cur].t < SWING_MS ? round.events[cur] : null;
  const planted = round.plant && t >= round.plant.t ? round.plant : null;
  const spikeLeft = planted && !(round.defuse && t >= round.defuse.t) ? planted.t + SPIKE_TIMER_MS - t : null;

  return (
    <div className="space-y-5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-lime/40" tabIndex={0} onKeyDown={onKey}
         aria-label={`Replay do round ${round.n}. Atalhos: espaço toca ou pausa; setas pulam para a jogada anterior ou a próxima.`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <WinBar match={match} wp={wp} swing={swing} byId={byId} />

          <MinimapBase
            src={match.map.minimap}
            alt={`Replay do round ${round.n} em ${match.map.name}`}
            className="!bg-[#0b0918]"
            overlay={
              <>
                <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-2.5 py-1.5 text-xs text-white backdrop-blur-sm">
                  <span className="tabular font-semibold">{clock(t)}</span>
                  {spikeLeft !== null && spikeLeft > 0 && <span className="ml-2 text-warn">◆ spike no {planted?.site ?? "?"} · {clock(spikeLeft)}</span>}
                  <span className={`mt-0.5 block text-[10px] ${registered ? "text-lime" : "text-white/60"}`}>
                    {registered ? "● posições registradas pela Riot"
                      : !smooth && lastReg !== undefined ? `◌ posições do registro de ${clock(lastReg)}`
                      : `◌ posições estimadas${nextReg !== undefined ? ` · próximo registro ${clock(nextReg)}` : ""}`}
                  </span>
                </div>
                {focusEvent && focusVictim && focusAt && <FocusLabel at={ally ? mid(focusAt, ally.at) : focusAt} e={focusEvent} meters={ally?.m ?? null} />}
                {t === 0 && !playing && (
                  <button type="button" onClick={togglePlay}
                          className="label-caps absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-lime px-6 py-3.5 text-[12px] text-bg shadow-xl [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)] hover:opacity-90">
                    ▶ Assistir o round
                  </button>
                )}
              </>
            }
          >
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath>
              {poses.map(({ tr, pose }, i) =>
                pose ? (
                  <radialGradient key={i} id={`${clipId}-g${i}`} gradientUnits="userSpaceOnUse" cx={pose.at.u} cy={pose.at.v} r={CONE_LEN}>
                    <stop offset="0" stopColor={TEAM_VAR[tr.p.color]} stopOpacity="0.7" />
                    <stop offset="1" stopColor={TEAM_VAR[tr.p.color]} stopOpacity="0" />
                  </radialGradient>
                ) : null,
              )}
            </defs>

            {planted?.xy && <Spike at={toMinimap(planted.xy, tf)} live={spikeLeft !== null && spikeLeft > 0} />}

            {/* quem já morreu: ícone apagado com ✕ da cor do time */}
            {poses.map(({ tr, dead }, i) =>
              dead && tr.deathXY ? <DeadMark key={`d${i}`} at={toMinimap(tr.deathXY, tf)} p={tr.p} clip={clipId} /> : null,
            )}

            {/* linha do tiro, logo depois de cada kill */}
            {shots.map((e, i) => {
              const k = toMinimap(e.killer_xy!, tf);
              const v = toMinimap(e.victim_xy!, tf);
              const c = byId.get(e.actor ?? "")?.color;
              return (
                <line key={`s${i}`} x1={k.u} y1={k.v} x2={v.u} y2={v.v} stroke={c ? TEAM_VAR[c] : "white"} strokeWidth={2}
                      strokeOpacity={1 - (t - e.t) / SHOT_MS} vectorEffect="non-scaling-stroke" />
              );
            })}

            {/* análise da morte: o aliado mais próximo podia trocar? */}
            {focusAt && ally && (
              <line x1={focusAt.u} y1={focusAt.v} x2={ally.at.u} y2={ally.at.v} stroke={ally.m > ISOLATED_M ? "var(--lime)" : "white"}
                    strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.9} vectorEffect="non-scaling-stroke" />
            )}

            {trail && trail.length > 1 && focus !== null && (
            <polyline points={trail.map((q) => `${q.u},${q.v}`).join(" ")} fill="none" stroke={TEAM_VAR[match.players[focus].color]} strokeWidth={2.5}
                      strokeOpacity={0.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}

          {jumps.map((l, i) => {
            const a = l.pts[0], b = l.pts[l.pts.length - 1];
            return (
              <g key={`j${i}`}>
                <line x1={a.u} y1={a.v} x2={b.u} y2={b.v} stroke="var(--lime)" strokeWidth={1.5} strokeDasharray="1 5" strokeLinecap="round"
                      vectorEffect="non-scaling-stroke" />
                <text x={(a.u + b.u) / 2} y={(a.v + b.v) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={0.03} fill="var(--lime)"
                      stroke="#0b0918" strokeWidth={0.006} paintOrder="stroke">↯</text>
                {l.note && (
                  <text x={(a.u + b.u) / 2} y={(a.v + b.v) / 2 + 0.032} textAnchor="middle" fontSize={0.017} fontWeight={700} fill="var(--lime)"
                        stroke="#0b0918" strokeWidth={0.005} paintOrder="stroke">
                    <title>{`${l.note.why} (${l.note.by})`}</title>
                    {l.note.label} · anotação da equipe
                  </text>
                )}
              </g>
            );
          })}

          {poses.map(({ dead, pose }, i) => (!dead && pose?.dir != null ? <Cone key={`c${i}`} pose={pose} fill={`url(#${clipId}-g${i})`} /> : null))}
            {poses.map(({ tr, dead, pose }, i) =>
            !dead && pose ? <Token key={`p${i}`} p={tr.p} at={pose.at} clip={clipId} selected={focus === i} onPick={() => pick(i)} /> : null,
          )}
          </MinimapBase>

          <Controls t={t} maxT={maxT} end={end} playing={playing} speed={speed} events={round.events} byId={byId}
                    onToggle={togglePlay} onSeek={seek} onSpeed={setSpeed} onCopy={copyLink} copied={copied} />

          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} className="mt-0.5 accent-[var(--brand-2)]" />
            <span>
              Movimento estimado. A Riot registra a posição e a mira de todos a cada kill, plant e desarme. Entre esses instantes, cada
              jogador segura a posição e anda pelos corredores a tempo de chegar no próximo registro (no começo, sai do spawn assim que a
              barreira cai); <b className="text-lime">↯</b> marca um deslocamento rápido demais para correr (habilidade de movimento ou
              teleporte) ou uma <b className="text-lime">anotação da equipe</b>. Desmarque para ver só os instantes registrados. O uso de utilitárias não vem nos dados; kills por habilidade, sim, com o ícone da habilidade.
              Clique num jogador (no mapa ou no elenco) para ver o caminho dele. Atalhos: espaço toca ou pausa; ← → pulam de jogada.
            </span>
          </label>
        </div>

        {/* no desktop a lista ocupa a altura da coluna do mapa (absoluta, para não esticar a linha) e rola por dentro */}
        <div className="relative min-w-0">
          <div className="flex flex-col rounded-xl border border-line bg-surface-2/40 lg:absolute lg:inset-0">
            <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
              <h3 className="font-display whitespace-nowrap text-base uppercase tracking-wide text-ink">Sequência do round</h3>
              <span className="label-caps whitespace-nowrap text-[9px] text-muted">chance · impacto</span>
            </div>
            <ol ref={listRef} className="relative max-h-[28rem] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
              {round.events.map((e, i) => (
                <SequenceRow key={i} i={i} e={e} byId={byId} past={i <= cur} current={i === cur} decisive={i === decisive}
                             onSeek={() => seek(e.t)} />
              ))}
            </ol>
          </div>
        </div>
      </div>
      <Rosters match={match} round={round} poses={poses} t={t} focus={focus} onPick={pick} />
    </div>
  );
}

const mid = (a: UV, b: UV): UV => ({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });

function WinBar({ match, wp, swing, byId }: { match: Match; wp: number; swing: RoundEvent | null; byId: Map<string, MatchPlayer> }) {
  const actor = swing?.actor ? byId.get(swing.actor) : undefined;
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="label-caps truncate text-team-red">{match.teams.Red.name}</span>
        <span className="label-caps hidden shrink-0 text-muted sm:inline">chance de vencer o round</span>
        <span className="label-caps truncate text-right text-team-blue">{match.teams.Blue.name}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <span className="font-display tabular w-14 text-2xl leading-none text-ink">{pct(wp)}</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-team-blue" role="img" aria-label={`${match.teams.Red.name} ${pct(wp)}, ${match.teams.Blue.name} ${pct(1 - wp)}`}>
          <div className="h-full bg-team-red" style={{ width: `${wp * 100}%` }} />
          <span className="absolute inset-y-0 left-1/2 w-px bg-bg/70" aria-hidden />
        </div>
        <span className="font-display tabular w-14 text-right text-2xl leading-none text-ink">{pct(1 - wp)}</span>
      </div>
      <p className="mt-1.5 h-4 text-xs text-ink-2">
        {swing && actor && (
          <>
            <span className={actor.color === "Red" ? "text-team-red" : "text-team-blue"}>●</span> {nick(actor.name)}: {describeShort(swing, byId)}{" "}
            <b className={swing.wpa >= 0 ? "text-good" : "text-bad"}>{pp(swing.wpa)}</b>
          </>
        )}
      </p>
    </div>
  );
}

function describeShort(e: RoundEvent, byId: Map<string, MatchPlayer>) {
  if (e.type === "plant") return "plantou a spike";
  if (e.type === "defuse") return "desarmou a spike";
  return `matou ${nick(byId.get(e.victim ?? "")?.name)}${e.weapon ? ` (${e.weapon})` : ""}`;
}

function Cone({ pose, fill }: { pose: Pose; fill: string }) {
  const { u, v } = pose.at;
  const a1 = pose.dir! - CONE_HALF;
  const a2 = pose.dir! + CONE_HALF;
  const d = `M${u} ${v}L${u + CONE_LEN * Math.cos(a1)} ${v + CONE_LEN * Math.sin(a1)}A${CONE_LEN} ${CONE_LEN} 0 0 1 ${u + CONE_LEN * Math.cos(a2)} ${v + CONE_LEN * Math.sin(a2)}Z`;
  return <path d={d} fill={fill} />;
}

function Token({ p, at, clip, selected, onPick }: { p: MatchPlayer; at: UV; clip: string; selected: boolean; onPick: () => void }) {
  const icon = p.minimap_icon ?? p.agent_icon;
  return (
    <g onClick={onPick} className="cursor-pointer">
      <title>{`${nick(p.name)} (${p.agent}): clique para ${selected ? "esconder" : "ver"} o caminho`}</title>
      {selected && <circle cx={at.u} cy={at.v} r={R + 0.011} fill="none" stroke="var(--lime)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
      <circle cx={at.u} cy={at.v} r={R + 0.004} fill={TEAM_VAR[p.color]} stroke="#0b0918" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {icon && <image href={icon} x={at.u - R} y={at.v - R} width={2 * R} height={2 * R} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />}
      <text x={at.u} y={at.v + R + 0.019} textAnchor="middle" fontSize={0.0155} fontWeight={600} fill="white" stroke="#0b0918" strokeWidth={0.005}
            paintOrder="stroke" className="hidden sm:inline">
        {nick(p.name)}
      </text>
    </g>
  );
}

function DeadMark({ at, p, clip }: { at: UV; p: MatchPlayer; clip: string }) {
  const icon = p.minimap_icon ?? p.agent_icon;
  const s = 0.011;
  const d = `M${at.u - s} ${at.v - s}L${at.u + s} ${at.v + s}M${at.u + s} ${at.v - s}L${at.u - s} ${at.v + s}`;
  return (
    <g opacity={0.8}>
      {icon && <image href={icon} x={at.u - R * 0.8} y={at.v - R * 0.8} width={1.6 * R} height={1.6 * R} clipPath={`url(#${clip})`} opacity={0.35}
                      style={{ filter: "grayscale(1)" }} />}
      <path d={d} stroke="#0b0918" strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={d} stroke={TEAM_VAR[p.color]} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function Spike({ at, live }: { at: UV; live: boolean }) {
  const s = 0.017;
  return (
    <g>
      {live && <circle cx={at.u} cy={at.v} r={0.035} fill="none" stroke="var(--warn)" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="animate-pulse" />}
      <polygon points={`${at.u},${at.v - s} ${at.u + s * 0.75},${at.v} ${at.u},${at.v + s} ${at.u - s * 0.75},${at.v}`} fill="var(--warn)"
               stroke="#0b0918" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function FocusLabel({ at, e, meters }: { at: UV; e: RoundEvent; meters: number | null }) {
  const isolated = meters !== null && meters > ISOLATED_M;
  const x = at.u < 0.2 ? "-10%" : at.u > 0.8 ? "-90%" : "-50%";
  return (
    <div className="pointer-events-none absolute z-10 w-max max-w-[15rem] rounded-md border border-line bg-bg/90 px-2 py-1 text-[11px] leading-snug text-ink shadow-lg"
         style={{ left: `${at.u * 100}%`, top: `${at.v * 100}%`, transform: `translate(${x}, calc(-100% - 10px))` }}>
      {meters === null ? "sem aliados vivos" : <>aliado mais perto a <b>{Math.round(meters)} m</b>{isolated && <b className="text-lime"> · isolado</b>}</>}
      <span className={e.traded ? "text-good" : "text-ink-2"}>{e.traded ? " · vingado" : " · não vingado"}</span>
    </div>
  );
}

function Controls({ t, maxT, end, playing, speed, events, byId, onToggle, onSeek, onSpeed, onCopy, copied }: {
  t: number; maxT: number; end: number; playing: boolean; speed: number; events: RoundEvent[]; byId: Map<string, MatchPlayer>;
  onToggle: () => void; onSeek: (ms: number) => void; onSpeed: (s: number) => void; onCopy: () => void; copied: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onToggle} aria-label={playing ? "Pausar replay" : "Tocar replay"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-lime text-bg hover:opacity-90">
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="flex shrink-0 overflow-hidden rounded-md border border-line" role="group" aria-label="Velocidade">
        {SPEEDS.map((s) => (
          <button key={s} type="button" onClick={() => onSpeed(s)} aria-pressed={speed === s}
                  className={`tabular px-2 py-1.5 text-xs ${speed === s ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}>
            {s}×
          </button>
        ))}
      </div>
      <div className="min-w-[10rem] flex-1">
        <input type="range" min={0} max={maxT} step={100} value={Math.round(t)} onChange={(e) => onSeek(Number(e.target.value))}
               aria-label="Tempo do round" aria-valuetext={clock(t)} className="w-full accent-[var(--lime)]" />
        <div className="relative mt-0.5 h-3">
          <span className="absolute top-0 h-full w-px bg-muted" style={{ left: `${(end / maxT) * 100}%` }} title={`Fim do round, aos ${clock(end)}`} />
          {events.map((e, i) => {
            const c = e.actor ? byId.get(e.actor)?.color : undefined;
            return (
              <button key={i} type="button" onClick={() => onSeek(e.t)} aria-label={`Ir para ${clock(e.t)}`} title={clock(e.t)}
                      className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-sm"
                      style={{ left: `${(e.t / maxT) * 100}%`, background: c ? TEAM_VAR[c] : "var(--muted)", opacity: e.after_round_end ? 0.35 : 1 }} />
            );
          })}
        </div>
      </div>
      <span className="tabular w-20 shrink-0 text-right text-sm text-ink-2">{clock(t)} / {clock(maxT)}</span>
      <button type="button" onClick={onCopy} title="Copia o link deste instante do round (para mandar ao time)"
              className={`label-caps shrink-0 rounded-md border px-2.5 py-1.5 text-[10px] transition-colors ${copied ? "border-lime text-lime" : "border-line text-ink-2 hover:border-ink-2 hover:text-ink"}`}>
        {copied ? "Link copiado ✓" : "Copiar link do momento"}
      </button>
    </div>
  );
}

function AgentDot({ p, dim }: { p: MatchPlayer | undefined; dim?: boolean }) {
  if (!p) return <span className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />;
  const icon = p.minimap_icon ?? p.agent_icon;
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ${p.color === "Red" ? "ring-team-red" : "ring-team-blue"} ${dim ? "opacity-60 grayscale" : ""}`}
          title={`${nick(p.name)} (${p.agent})`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon && <img src={icon} alt={p.agent} className="h-full w-full object-cover" />}
    </span>
  );
}

function SequenceRow({ i, e, byId, past, current, decisive, onSeek }: {
  i: number; e: RoundEvent; byId: Map<string, MatchPlayer>; past: boolean; current: boolean; decisive: boolean; onSeek: () => void;
}) {
  const actor = e.actor ? byId.get(e.actor) : undefined;
  const victim = e.victim ? byId.get(e.victim) : undefined;
  const mine = actor?.color === "Blue" ? [1 - e.wp_red_before, 1 - e.wp_red_after] : [e.wp_red_before, e.wp_red_after];
  return (
    <li data-i={i} className={`border-b border-line/60 last:border-b-0 ${past ? "" : "opacity-45"}`}>
      <button type="button" onClick={onSeek} aria-current={current ? "step" : undefined}
              className={`relative grid w-full grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 ${current ? "bg-surface-2" : ""}`}>
        {current && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-lime" aria-hidden />}
        <span className="tabular text-xs text-muted">{clock(e.t)}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <AgentDot p={actor} />
            {e.type === "kill" ? (
              <>
                <KillIcon e={e} />
                <AgentDot p={victim} dim />
              </>
            ) : (
              <span className="label-caps whitespace-nowrap text-[10px] text-warn">◆ {e.type === "plant" ? "plant" : "desarme"}</span>
            )}
          </span>
          <span className="mt-1 block break-words text-xs text-ink-2">
            {nick(actor?.name)}
            {e.type === "kill" ? <> → {nick(victim?.name)}</> : e.type === "plant" ? " plantou" : " desarmou"}
            {e.first_blood && <span className="text-muted"> · first blood</span>}
            {e.is_trade && <span className="text-muted"> · trade</span>}
            {e.after_round_end && <span className="text-muted"> · após o fim</span>}
            {decisive && <span className="font-semibold text-lime"> · maior impacto</span>}
          </span>
        </span>
        <span className="tabular text-right text-xs">
          {e.after_round_end ? (
            <span className="text-muted">sem efeito</span>
          ) : (
            <>
              <span className="text-ink-2">{pct(mine[0])} → {pct(mine[1])}</span>
              <span className={`block font-semibold ${e.wpa >= 0 ? "text-good" : "text-bad"}`}>{pp(e.wpa)}</span>
            </>
          )}
        </span>
      </button>
    </li>
  );
}

function KillIcon({ e }: { e: RoundEvent }) {
  if (e.weapon_icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={e.weapon_icon} alt={e.weapon ?? ""} title={e.weapon ?? ""}
                className={`shrink-0 object-contain ${e.kill_kind === "ability" ? "h-5 w-5" : "h-4 w-12 -scale-x-100"}`} />;
  }
  return <span className="label-caps shrink-0 rounded-sm bg-surface-2 px-1 py-0.5 text-[9px] text-ink-2">{e.weapon ?? "?"}</span>;
}

function Rosters({ match, round, poses, t, focus, onPick }: {
  match: Match; round: Round; poses: { tr: Track; dead: boolean }[]; t: number; focus: number | null; onPick: (i: number) => void;
}) {
  const killsBy = new Map<string, number>();
  for (const e of round.events) if (e.type === "kill" && e.actor && !e.teamkill && e.t <= t) killsBy.set(e.actor, (killsBy.get(e.actor) ?? 0) + 1);
  const side = (c: Color) => (round.attacker === c ? "Ataque" : "Defesa");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["Red", "Blue"] as Color[]).map((c) => (
        <div key={c} className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className={`label-caps truncate text-[11px] ${c === "Red" ? "text-team-red" : "text-team-blue"}`}>{match.teams[c].name}</span>
            <span className="label-caps shrink-0 text-[10px] text-muted">{side(c)} · {round.buy[c]}</span>
          </div>
          <ul className="space-y-1">
            {poses.map(({ tr, dead }, i) => {
              if (tr.p.color !== c) return null;
              const g = round.gear?.[i];
              const icon = g?.[0] ? match.weapon_icons?.[g[0]] : undefined;
              const k = killsBy.get(tr.p.puuid) ?? 0;
              return (
                <li key={tr.p.puuid}>
                  <button type="button" onClick={() => onPick(i)} aria-pressed={focus === i} title="Ver o caminho deste jogador no mapa"
                          className={`flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs transition-colors hover:bg-surface-2 ${
                            focus === i ? "bg-surface-2 ring-1 ring-lime/60" : ""} ${dead ? "opacity-45" : ""}`}>
                  <AgentDot p={tr.p} dim={dead} />
                  <span className={`min-w-0 flex-1 truncate ${dead ? "text-muted line-through" : "text-ink"}`}>{nick(tr.p.name)}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {icon ? <img src={icon} alt={g?.[0] ?? ""} title={g?.[0] ?? ""} className="h-3.5 w-12 object-contain opacity-80" />
                        : <span className="w-12 text-right text-muted">{g?.[0] ?? "—"}</span>}
                  <Armor a={g?.[1]} />
                  <span className="tabular w-8 text-right text-ink-2" title="kills neste round até agora">{k ? `${k} K` : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Colete: escudo + valor (50 pesado, 25 leve, R regenerativo); o nome completo fica no title. */
function Armor({ a }: { a: string | null | undefined }) {
  const v = !a ? null : /pesad/i.test(a) ? "50" : /leve/i.test(a) ? "25" : /regenera/i.test(a) ? "R" : "?";
  return (
    <span title={a ?? "sem colete"} className="tabular flex w-9 shrink-0 items-center justify-end gap-1 text-muted">
      {v && <svg viewBox="0 0 10 12" aria-hidden className="h-3 w-2.5 fill-current"><path d="M5 0 10 2v4c0 3-2.2 5.2-5 6C2.2 11.2 0 9 0 6V2z" /></svg>}
      {v ?? "—"}
    </span>
  );
}

"use client";
// Minimapa "replay" do round: cada morte (✕ na cor do time da vítima), a posição de quem matou ligada à vítima,
// o plant da spike e um controle de tempo que mostra só o que aconteceu até aquele instante.
// Eventos depois do fim do round (after_round_end) aparecem esmaecidos.
import { useEffect, useMemo, useState } from "react";
import type { Color, Match, MatchPlayer, Round } from "@/lib/types";
import { clock, nick, RESULT_PT } from "@/lib/format";
import { roundEndMs, toMinimap, type UV } from "@/lib/minimap";
import MinimapBase from "@/components/MinimapBase";

const TEAM_VAR: Record<Color, string> = { Red: "var(--team-red)", Blue: "var(--team-blue)" };
const PLAY_SPEED = 4; // replay 4× mais rápido que o tempo real
const CROSS = 0.011; // meia-largura do ✕, em fração do mapa
const LATE_OPACITY = 0.35;

type Mark =
  | { kind: "kill"; id: string; t: number; late: boolean; at: UV; killer: UV | null; color: Color; killerColor: Color | null; text: string }
  | { kind: "plant"; id: string; t: number; late: boolean; at: UV; text: string };

type Tick = { id: string; t: number; late: boolean; color: Color | null; text: string };

/** Pré-calcula tudo que o replay desenha (uma vez por round; o slider só filtra por tempo). */
function buildReplay(match: Match, round: Round) {
  const players = new Map<string, MatchPlayer>(match.players.map((p) => [p.puuid, p]));
  const who = (id: string | null | undefined) => {
    const p = id ? players.get(id) : undefined;
    return p ? `${nick(p.name)} (${p.agent})` : "?";
  };
  const colorOf = (id: string | null | undefined) => (id ? players.get(id)?.color ?? null : null);
  const late = (text: string, isLate: boolean) => (isLate ? `${text} · depois do fim do round` : text);
  const tf = match.map.transform;

  const marks: Mark[] = [];
  const ticks: Tick[] = [];

  round.events.forEach((e, i) => {
    const id = `${e.type}-${i}`;
    if (e.type === "kill") {
      const text = late(
        e.actor
          ? `${who(e.actor)} matou ${e.teamkill ? "o aliado " : ""}${who(e.victim)}${e.weapon ? ` com ${e.weapon}` : ""}, aos ${clock(e.t)}`
          : `${who(e.victim)} morreu, aos ${clock(e.t)}`,
        e.after_round_end,
      );
      ticks.push({ id, t: e.t, late: e.after_round_end, color: colorOf(e.actor), text });
      const color = colorOf(e.victim);
      if (!e.victim_xy || !color) return;
      marks.push({
        kind: "kill",
        id,
        t: e.t,
        late: e.after_round_end,
        at: toMinimap(e.victim_xy, tf),
        killer: e.killer_xy ? toMinimap(e.killer_xy, tf) : null,
        color,
        killerColor: colorOf(e.actor),
        text,
      });
    } else if (e.type === "plant") {
      const site = round.plant?.site;
      const text = late(`${who(e.actor)} plantou a spike${site ? ` no ${site}` : ""}, aos ${clock(e.t)}`, e.after_round_end);
      ticks.push({ id, t: e.t, late: e.after_round_end, color: colorOf(e.actor), text });
      if (round.plant?.xy) {
        marks.push({ kind: "plant", id, t: e.t, late: e.after_round_end, at: toMinimap(round.plant.xy, tf), text });
      }
    } else {
      ticks.push({ id, t: e.t, late: e.after_round_end, color: colorOf(e.actor), text: late(`${who(e.actor)} desarmou a spike, aos ${clock(e.t)}`, e.after_round_end) });
    }
  });

  const end = roundEndMs(round);
  const lastEvent = round.events.reduce((m, e) => Math.max(m, e.t), 0);
  const maxT = Math.ceil(Math.max(end, lastEvent) / 1000) * 1000; // arredonda para o segundo
  return { marks, ticks, end, maxT };
}

export default function Minimap({ match, round }: { match: Match; round: Round }) {
  // A key reinicia o estado (tempo, play, hover) quando o round muda.
  return <MinimapReplay key={`${match.id}:${round.n}`} match={match} round={round} />;
}

function MinimapReplay({ match, round }: { match: Match; round: Round }) {
  const { marks, ticks, end, maxT } = useMemo(() => buildReplay(match, round), [match, round]);
  const [t, setT] = useState(maxT); // começa mostrando o round inteiro
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  // Replay: avança o tempo com requestAnimationFrame enquanto estiver tocando.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) * PLAY_SPEED;
      last = now;
      setT((prev) => Math.min(prev + dt, maxT));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, maxT]);

  useEffect(() => {
    if (playing && t >= maxT) setPlaying(false);
  }, [playing, t, maxT]);

  const visible = useMemo(() => marks.filter((m) => m.t <= t), [marks, t]);
  const hovered = visible.find((m) => m.id === hover) ?? null;
  const deaths = visible.filter((m) => m.kind === "kill" && !m.late).length;

  const togglePlay = () => {
    if (!playing && t >= maxT) setT(0); // no fim: recomeça do zero
    setPlaying((p) => !p);
  };
  const seek = (ms: number) => {
    setPlaying(false);
    setT(ms);
  };

  const hoverProps = (id: string) => ({
    onPointerEnter: () => setHover(id),
    onPointerLeave: () => setHover((h) => (h === id ? null : h)),
    onClick: () => setHover((h) => (h === id ? null : id)), // toque no celular
  });

  return (
    <div className="flex flex-col gap-3">
      <MinimapBase
        src={match.map.minimap}
        alt={`Minimapa de ${match.map.name}, round ${round.n}`}
        overlay={hovered && <Tooltip at={hovered.at} text={hovered.text} />}
      >
        {visible.map((m) =>
          m.kind === "kill" ? (
            <g key={m.id} opacity={m.late ? LATE_OPACITY : 1} className="cursor-pointer" {...hoverProps(m.id)}>
              {m.killer && (
                <>
                  <line
                    x1={m.killer.u} y1={m.killer.v} x2={m.at.u} y2={m.at.v}
                    stroke={m.killerColor ? TEAM_VAR[m.killerColor] : "var(--muted)"}
                    strokeWidth={1.25} strokeOpacity={0.7} vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={m.killer.u} cy={m.killer.v} r={0.0065}
                    fill={m.killerColor ? TEAM_VAR[m.killerColor] : "var(--muted)"}
                    stroke="var(--bg)" strokeWidth={1} vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
              <Cross at={m.at} color={TEAM_VAR[m.color]} active={m.id === hover} />
              {/* área de toque maior que o desenho */}
              <circle cx={m.at.u} cy={m.at.v} r={0.022} fill="transparent" />
            </g>
          ) : (
            <g key={m.id} opacity={m.late ? LATE_OPACITY : 1} className="cursor-pointer" {...hoverProps(m.id)}>
              <SpikeIcon at={m.at} active={m.id === hover} />
              <circle cx={m.at.u} cy={m.at.v} r={0.022} fill="transparent" />
            </g>
          ),
        )}
      </MinimapBase>

      {/* Controle de tempo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pausar replay" : "Tocar replay"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-ink hover:bg-surface"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={maxT}
            step={100}
            value={Math.round(t)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Tempo do round"
            aria-valuetext={clock(t)}
            className="w-full accent-accent"
          />
          {/* Linha do tempo: um traço por evento (clique para pular até ele) + fim do round */}
          <div className="relative mt-1 h-3">
            <span
              className="absolute top-0 h-full w-px bg-muted"
              style={{ left: `${(end / maxT) * 100}%` }}
              title={`Fim do round (${RESULT_PT[round.result] ?? round.result}), aos ${clock(end)}`}
            />
            {ticks.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => seek(k.t)}
                title={k.text}
                aria-label={k.text}
                className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-sm"
                style={{
                  left: `${(k.t / maxT) * 100}%`,
                  background: k.color ? TEAM_VAR[k.color] : "var(--muted)",
                  opacity: k.late ? LATE_OPACITY : 1,
                }}
              />
            ))}
          </div>
        </div>
        <span className="tabular w-20 shrink-0 text-right text-sm text-ink-2">
          {clock(t)} / {clock(maxT)}
        </span>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        {(["Red", "Blue"] as const).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_VAR[c] }} />
            {match.teams[c].name}
          </span>
        ))}
        <span>✕ morte · ● quem matou · ◆ spike</span>
        <span className="text-muted">esmaecido = depois do fim do round</span>
        <span className="tabular ml-auto text-muted">{deaths} {deaths === 1 ? "morte" : "mortes"} até {clock(t)}</span>
      </div>
    </div>
  );
}

function Cross({ at, color, active }: { at: UV; color: string; active: boolean }) {
  const d = `M${at.u - CROSS} ${at.v - CROSS}L${at.u + CROSS} ${at.v + CROSS}M${at.u + CROSS} ${at.v - CROSS}L${at.u - CROSS} ${at.v + CROSS}`;
  return (
    <>
      {/* contorno escuro para o ✕ aparecer sobre qualquer parte do mapa */}
      <path d={d} stroke="var(--bg)" strokeWidth={active ? 6 : 5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={d} stroke={color} strokeWidth={active ? 3.5 : 2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </>
  );
}

function SpikeIcon({ at, active }: { at: UV; active: boolean }) {
  const s = active ? 0.02 : 0.016;
  const points = `${at.u},${at.v - s} ${at.u + s * 0.75},${at.v} ${at.u},${at.v + s} ${at.u - s * 0.75},${at.v}`;
  return <polygon points={points} fill="var(--warn)" stroke="var(--bg)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
}

function Tooltip({ at, text }: { at: UV; text: string }) {
  // Vira para baixo perto da borda de cima e encosta nas laterais para não sair da imagem.
  const below = at.v < 0.18;
  const x = at.u < 0.2 ? "-10%" : at.u > 0.8 ? "-90%" : "-50%";
  const y = below ? "14px" : "calc(-100% - 14px)";
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max max-w-[16rem] rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink shadow-lg"
      style={{ left: `${at.u * 100}%`, top: `${at.v * 100}%`, transform: `translate(${x}, ${y})` }}
    >
      {text}
    </div>
  );
}

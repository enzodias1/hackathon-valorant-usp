"use client";
// "Onde o time morre": regiões do mapa com mais mortes do time, comparadas com a liga, por mapa e lado.
// O desenho do mapa de calor entra no espaço reservado (reaproveitando o minimapa do Nukan).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Side, TeamZones } from "@/lib/types";
import { pct } from "@/lib/format";
import { decodeNavGrid, regionCells, type NavGridRaw } from "@/lib/navgrid";
import MinimapBase from "@/components/MinimapBase";

type ZoneMap = TeamZones["maps"][number];
type SideData = NonNullable<ZoneMap["sides"][Side]>;
const TOP = 8; // por padrão, as 8 regiões com mais mortes

export default function ZonesPanel({ zones, navs = {} }: { zones: TeamZones; navs?: Record<string, NavGridRaw | null> }) {
  const [mi, setMi] = useState(0);
  const [side, setSide] = useState<Side>("Defesa");
  const [sel, setSel] = useState<string | null>(null); // região acesa no mapa
  const [all, setAll] = useState(false); // tabela com todas as regiões
  const [onlyUntraded, setOnlyUntraded] = useState(false);
  // mapas escolhidos no "Exportar PDF" (components/site/ExportPdf.tsx): enquanto a impressão está aberta, a seção mostra
  // cada um deles com ataque e defesa, no lugar do mapa da tela
  const [printMaps, setPrintMaps] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = (e: Event) => setPrintMaps((e as CustomEvent<string[] | null>).detail);
    el.addEventListener("pdf-choices", on);
    return () => el.removeEventListener("pdf-choices", on);
  }, []);

  if (!zones.maps.length) return <p className="text-sm text-ink-2">Sem mortes registradas.</p>;
  const mp = zones.maps[mi];
  const s = mp.sides[side];
  const pick = (z: string | null) => setSel((cur) => (cur === z ? null : z));
  const selZone = sel ? s?.zones.find((z) => z.zone === sel) : undefined;
  const choices = JSON.stringify({
    label: "Mapas (ataque e defesa)",
    options: zones.maps.map((m) => ({ value: m.code, label: `${m.map} (${m.deaths} mortes)` })),
    selected: [mp.code],
  });
  const filter = { onlyUntraded, setOnlyUntraded };

  return (
    <div ref={ref} data-pdf-choices={choices} className="space-y-4">
      {printMaps ? (
        <div className="space-y-6">
          <p className="text-sm text-ink-2">
            {onlyUntraded ? "Só mortes sem trade" : "Todas as mortes"} · {all ? "todas as regiões" : `as ${TOP} regiões com mais mortes`} em cada lado.
            Cada morte é atribuída à região nomeada mais próxima do mapa. ▼: morre sem trade nessa região mais que a liga, com confirmação estatística.
          </p>
          {zones.maps.filter((m) => printMaps.includes(m.code)).map((m, i) => (
            <div key={m.code} className={`space-y-4 ${i > 0 ? "break-before-page" : ""}`}>
              <h3 className="text-xl text-ink">{m.map} <span className="text-sm text-muted">· {m.deaths} mortes</span></h3>
              {(["Ataque", "Defesa"] as Side[]).map((sd) => {
                const d = m.sides[sd];
                return (
                  // mapa de calor menor à esquerda e tabela compacta à direita: ataque e defesa de um mapa cabem numa folha
                  <div key={sd} className="grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-5 break-inside-avoid">
                    <Heatmap map={m} grid={d?.grid ?? []} size={zones.grid_size} nav={navs[m.code] ?? null} sel={null} {...filter} />
                    <div className="min-w-0">
                      <p className="mb-1 text-sm text-ink">
                        <span className={sd === "Ataque" ? "text-atk" : "text-def"}>●</span> {sd}
                        {d && <span className="text-xs text-muted"> · {d.deaths} mortes em {d.rounds} rounds</span>}
                      </p>
                      {d?.zones.length ? <ZoneTable side={d} all={all} compact /> : <p className="text-sm text-ink-2">Sem mortes neste lado.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* no PDF os controles somem (data-print-hide) e fica escrito o que está selecionado */}
            <span className="hidden text-sm font-semibold text-ink print:inline">{mp.map} · {side}</span>
            <select data-print-hide value={mi} onChange={(e) => { setMi(Number(e.target.value)); setSel(null); }} aria-label="Mapa"
                    className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none">
              {zones.maps.map((m, i) => <option key={m.code} value={i}>{m.map} ({m.deaths} mortes)</option>)}
            </select>
            {(["Ataque", "Defesa"] as Side[]).map((sd) => (
              <button key={sd} data-print-hide onClick={() => setSide(sd)} aria-pressed={side === sd}
                      className={`rounded-md border px-3 py-1.5 text-sm ${side === sd ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2 hover:border-ink-2"}`}>
                <span className={sd === "Ataque" ? "text-atk" : "text-def"}>●</span> {sd}
              </button>
            ))}
            {s && <span className="text-xs text-muted">{s.deaths} mortes em {s.rounds} rounds</span>}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              {!s?.zones.length ? <p className="text-sm text-ink-2">Sem mortes neste lado.</p> : (
                <ZoneTable side={s} all={all} sel={sel} onPick={pick} onToggleAll={() => setAll((a) => !a)} />
              )}
              <p className="mt-2 text-xs text-muted">
                Cada morte é atribuída à região nomeada mais próxima do mapa.{" "}
                <span data-print-hide>Clique numa região (aqui ou no mapa) para ver onde ela fica.</span>
                ▼: morre sem trade nessa região mais que a liga, com confirmação estatística.
              </p>
            </div>
            <div className="min-w-0">
              <Heatmap map={mp} grid={s?.grid ?? []} size={zones.grid_size} nav={navs[mp.code] ?? null} sel={sel} onPick={pick} {...filter} />
              {sel && (
                <p className="mt-2 text-sm text-ink-2">
                  <b className="text-lime">{sel}</b>:{" "}
                  {selZone ? <>{pct(selZone.share)} das mortes do time neste lado (liga {pct(selZone.league_share)}), {pct(selZone.untraded_rate)} sem trade.</>
                    : "sem mortes do time neste lado."}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Tabela das regiões de um lado: % das mortes do time (traço: liga) e % sem trade. Sem `onPick`, é estática (PDF). */
function ZoneTable({ side, all, sel = null, onPick, onToggleAll, compact }: {
  side: SideData; all: boolean; sel?: string | null; onPick?: (zone: string) => void; onToggleAll?: () => void;
  /** versão baixa para o PDF (linhas e barra menores) */
  compact?: boolean;
}) {
  const py = compact ? "py-1" : "py-2";
  const total = side.zones.length;
  const top = side.zones.slice(0, all ? undefined : TOP);
  const maxShare = Math.max(...top.map((z) => Math.max(z.share, z.league_share)), 0.01);
  return (
    <>
      <table className={`w-full ${compact ? "text-xs" : "text-sm"}`}>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className={`${py} pr-2`}>Região</th><th className={`${py} pr-2`}>% das mortes do time <span className="normal-case">(traço: liga)</span></th><th className={`${py} text-right`}>Sem trade</th>
          </tr>
        </thead>
        <tbody>
          {top.map((z) => (
            <tr key={z.zone} onClick={onPick && (() => onPick(z.zone))} aria-selected={sel === z.zone}
                className={`border-t border-line/50 transition-colors ${onPick ? "cursor-pointer hover:bg-surface-2" : ""} ${sel === z.zone ? "bg-surface-2" : ""}`}>
              <td className={`${py} pr-2 ${sel === z.zone ? "text-lime" : "text-ink"}`}>
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${sel === z.zone ? "bg-lime" : "border border-line"}`} aria-hidden />
                {z.zone}
              </td>
              <td className={`${py} pr-2`}>
                <div className="flex items-center gap-2">
                  <div className={`relative h-2.5 shrink-0 rounded-sm bg-surface-2 ${compact ? "w-16" : "w-28"}`}>
                    <div className="absolute inset-y-0 left-0 rounded-sm bg-accent" style={{ width: `${(z.share / maxShare) * 100}%` }} />
                    <div className="absolute -top-0.5 h-3.5 w-0.5 bg-ink-2" style={{ left: `${(z.league_share / maxShare) * 100}%` }} />
                  </div>
                  <span className="tabular text-ink">{pct(z.share)}</span>
                  <span className="tabular text-xs text-muted">liga {pct(z.league_share)}</span>
                </div>
              </td>
              <td className={`tabular ${py} text-right`}>
                <span className={z.worse_than_league ? "text-bad" : "text-ink"}>{pct(z.untraded_rate)}</span>
                {z.worse_than_league && <span className="text-bad"> ▼</span>}
                <span className="block text-xs text-muted">liga {pct(z.league_untraded_rate)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {onToggleAll && total > TOP && (
        <button type="button" data-print-hide onClick={onToggleAll} aria-expanded={all}
                className="mt-1 flex w-full items-center justify-center gap-2 border-t border-line/50 py-2 text-xs text-ink-2 transition-colors hover:text-ink">
          {all ? `Mostrar só as ${TOP} com mais mortes` : `Ver todas as ${total} regiões`}
          <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform ${all ? "rotate-180" : ""}`} fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 6l4 4 4-4" /></svg>
        </button>
      )}
    </>
  );
}

/** Escala de calor (amarelo → laranja → vermelho, do menos ao mais intenso): lê bem sobre o cinza do minimapa. */
const HEAT = [[255, 224, 102], [255, 140, 26], [222, 38, 38]];
function heat(t: number) {
  const x = Math.min(1, Math.max(0, t)) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(x));
  const f = x - i;
  const [r, g, b] = HEAT[i].map((c, k) => Math.round(c + (HEAT[i + 1][k] - c) * f));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Mapa de calor: grade sobre o minimapa; quanto mais quente e forte a célula, mais mortes do time ali (todas ou só as sem trade).
 *  A cor segue a contagem e a opacidade cresce mais rápido, para áreas com poucas mortes ficarem visíveis sem competir com as quentes. */
function Heatmap({ map, grid, size, nav, sel, onPick, onlyUntraded, setOnlyUntraded }: {
  map: ZoneMap; grid: [number, number, number, number][]; size: number;
  nav: NavGridRaw | null; sel: string | null; onPick?: (zone: string) => void;
  onlyUntraded: boolean; setOnlyUntraded: (v: boolean) => void;
}) {
  const regions = useMemo(() => {
    if (!nav?.callouts?.length) return null;
    const g = decodeNavGrid(nav);
    return { g, ...regionCells(g, nav.callouts) };
  }, [nav]);
  const selIdx = regions && sel ? regions.names.indexOf(sel) : -1;
  // nomes no mapa: sem o "Meio" (curto) e afastados quando dois se sobrepõem
  const labels = useMemo(() => {
    if (!regions) return [];
    const FS = 0.021;
    const out = regions.names.map((name, i) => ({ name, text: name.replace(/^Meio · /, "").replace(" · ", " "), at: regions.at[i] }))
      .filter((l): l is { name: string; text: string; at: { u: number; v: number } } => !!l.at)
      .map((l) => ({ ...l, u: l.at.u, v: l.at.v, w: l.text.length * FS * 0.56 }));
    for (let pass = 0; pass < 4; pass++) {
      for (let a = 0; a < out.length; a++) {
        for (let b = a + 1; b < out.length; b++) {
          const A = out[a], B = out[b];
          if (Math.abs(A.u - B.u) < (A.w + B.w) / 2 && Math.abs(A.v - B.v) < FS * 1.15) {
            const push = (FS * 1.15 - Math.abs(A.v - B.v)) / 2 + 0.001;
            if (A.v <= B.v) { A.v -= push; B.v += push; } else { A.v += push; B.v -= push; }
          }
        }
      }
    }
    return out;
  }, [regions]);
  const pickAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!regions || !onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const { g, owner, names } = regions;
    const c = Math.floor(((e.clientX - r.left) / r.width) * g.n), row = Math.floor(((e.clientY - r.top) / r.height) * g.n);
    const o = c >= 0 && c < g.n && row >= 0 && row < g.n ? owner[row * g.n + c] : -1;
    if (o >= 0) onPick(names[o]);
  };
  const value = (c: [number, number, number, number]) => (onlyUntraded ? c[3] : c[2]);
  const cells = grid.filter((c) => value(c) > 0);
  const max = Math.max(1, ...cells.map(value));
  const total = cells.reduce((s, c) => s + value(c), 0);
  const cell = 1 / size;
  return (
    <div className="flex flex-col gap-2">
      <div onClick={pickAt} className={regions && onPick ? "cursor-pointer" : ""}>
      <MinimapBase src={map.minimap} alt={`Mapa de calor das mortes em ${map.map}`}>
        {cells.map((c) => {
          const v = value(c);
          return (
            <rect key={`${c[0]}-${c[1]}`} x={c[0] * cell} y={c[1] * cell} width={cell} height={cell}
                  fill={heat(v / max)} fillOpacity={0.25 + 0.65 * Math.sqrt(v / max)}>
              <title>{`${v} ${v === 1 ? "morte" : "mortes"}${onlyUntraded ? " sem trade" : ""} nesta área`}</title>
            </rect>
          );
        })}
        {regions && selIdx >= 0 && (
          // a área da região escolhida, por cima do calor
          <path fill="var(--lime)" fillOpacity={0.32} stroke="none"
                d={Array.from(regions.owner).flatMap((o, i) => (o === selIdx
                  ? [`M${(i % regions.g.n) / regions.g.n} ${Math.floor(i / regions.g.n) / regions.g.n}h${1 / regions.g.n}v${1 / regions.g.n}h${-1 / regions.g.n}z`] : [])).join("")} />
        )}
        {labels.map(({ name, text, u, v }) => {
          const on = name === sel;
          return (
            <text key={name} x={u} y={v} textAnchor="middle" dominantBaseline="middle" fontSize={on ? 0.026 : 0.021}
                  fontWeight={on ? 700 : 600} fill={on ? "var(--lime)" : "#fff"} stroke="#0b0a1a" strokeWidth={on ? 0.007 : 0.005}
                  paintOrder="stroke" opacity={selIdx >= 0 && !on ? 0.55 : 0.95} style={{ pointerEvents: "none" }}>
              {on ? name.replace(" · ", " ") : text}
            </text>
          );
        })}
      </MinimapBase>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
        <span className="hidden text-ink print:inline">{onlyUntraded ? "Só mortes sem trade" : "Todas as mortes"}</span>
        <div data-print-hide className="flex gap-1" role="group" aria-label="Quais mortes mostrar">
          {[false, true].map((u) => (
            <button key={String(u)} onClick={() => setOnlyUntraded(u)} aria-pressed={onlyUntraded === u}
                    className={`rounded-md border px-2 py-1 ${onlyUntraded === u ? "border-ink bg-surface-2 text-ink" : "border-line hover:border-ink-2"}`}>
              {u ? "Só mortes sem trade" : "Todas as mortes"}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5">
          menos
          <span className="h-2.5 w-20 rounded-sm" style={{ background: `linear-gradient(to right, ${heat(0)}, ${heat(0.5)}, ${heat(1)})` }} />
          mais · {total} mortes
        </span>
      </div>
    </div>
  );
}

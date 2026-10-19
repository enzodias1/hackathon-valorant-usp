"use client";
// "Onde vocês morrem": regiões do mapa com mais mortes do time, comparadas com a liga, por mapa e lado.
// O desenho do mapa de calor entra no espaço reservado (reaproveitando o minimapa do Nukan).
import { useState } from "react";
import type { Side, TeamZones } from "@/lib/types";
import { pct } from "@/lib/format";

export default function ZonesPanel({ zones }: { zones: TeamZones }) {
  const [mi, setMi] = useState(0);
  const [side, setSide] = useState<Side>("Defesa");
  if (!zones.maps.length) return <p className="text-sm text-ink-2">Sem mortes registradas.</p>;
  const mp = zones.maps[mi];
  const s = mp.sides[side];
  const top = (s?.zones ?? []).slice(0, 8);
  const maxShare = Math.max(...top.map((z) => Math.max(z.share, z.league_share)), 0.01);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={mi} onChange={(e) => setMi(Number(e.target.value))} aria-label="Mapa"
                className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none">
          {zones.maps.map((m, i) => <option key={m.code} value={i}>{m.map} ({m.deaths} mortes)</option>)}
        </select>
        {(["Ataque", "Defesa"] as Side[]).map((sd) => (
          <button key={sd} onClick={() => setSide(sd)} aria-pressed={side === sd}
                  className={`rounded-md border px-3 py-1.5 text-sm ${side === sd ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2 hover:border-ink-2"}`}>
            <span className={sd === "Ataque" ? "text-atk" : "text-def"}>●</span> {sd}
          </button>
        ))}
        {s && <span className="text-xs text-muted">{s.deaths} mortes em {s.rounds} rounds</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          {!top.length ? <p className="text-sm text-ink-2">Sem mortes neste lado.</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Região</th><th className="py-2 pr-2">% das mortes do time <span className="normal-case">(traço: liga)</span></th><th className="py-2 text-right">Sem trade</th>
                </tr>
              </thead>
              <tbody>
                {top.map((z) => (
                  <tr key={z.zone} className="border-t border-line/50">
                    <td className="py-2 pr-2 text-ink">{z.zone}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="relative h-2.5 w-28 shrink-0 rounded-sm bg-surface-2">
                          <div className="absolute inset-y-0 left-0 rounded-sm bg-accent" style={{ width: `${(z.share / maxShare) * 100}%` }} />
                          <div className="absolute -top-0.5 h-3.5 w-0.5 bg-ink-2" style={{ left: `${(z.league_share / maxShare) * 100}%` }} />
                        </div>
                        <span className="tabular text-ink">{pct(z.share)}</span>
                        <span className="tabular text-xs text-muted">liga {pct(z.league_share)}</span>
                      </div>
                    </td>
                    <td className="tabular py-2 text-right">
                      <span className={z.worse_than_league ? "text-bad" : "text-ink"}>{pct(z.untraded_rate)}</span>
                      {z.worse_than_league && <span className="text-bad"> ▼</span>}
                      <span className="block text-xs text-muted">liga {pct(z.league_untraded_rate)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted">
            Cada morte é atribuída à região nomeada mais próxima do mapa. ▼: morre sem trade nessa região mais que a liga, com confirmação estatística.
          </p>
        </div>
        <div>
          {(
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">
              Mapa de calor das mortes (em construção)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

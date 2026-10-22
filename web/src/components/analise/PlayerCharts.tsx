"use client";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Player } from "@/lib/types";
import { date, num, pp } from "@/lib/format";

export function MatchImpactChart({ matches }: { matches: Player["matches"] }) {
  const data = matches.map((m, i) => ({ ...m, i: i + 1 }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Impacto do jogador em cada partida (pontos de chance)">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap={2}>
          <XAxis dataKey="i" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const m = payload[0].payload as (typeof data)[number];
            return (
              <Tip>
                <b>{m.won ? "Vitória" : "Derrota"} {m.score_for}–{m.score_against} vs {m.opponent_name}</b><br />
                <span className="text-ink-2">{date(m.date)} · {m.map} · {m.agent}</span><br />
                Impacto <b>{pp(m.wpa)}</b> · K/D/A {m.kills}/{m.deaths}/{m.assists} · ACS {num(m.acs)}
              </Tip>
            );
          }} />
          <Bar dataKey="wpa" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((m) => <Cell key={m.id} fill={m.wpa >= 0 ? "var(--good)" : "var(--bad)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink shadow-lg">{children}</div>;
}

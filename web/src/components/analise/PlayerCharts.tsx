"use client";
import { Bar, BarChart, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Axes, Player } from "@/lib/types";
import { date, num, pp } from "@/lib/format";

const AXIS_HELP: Record<string, string> = {
  Entry: "abre os rounds: disputa os primeiros duelos",
  Support: "assistências e trades: joga para o time",
  Lurker: "joga longe do time, por flancos",
  Clutch: "decide o fim do round: clutches e pós-plant",
  Impacto: "muda a chance de vitória do round",
};

export function RoleRadar({ axes }: { axes: Axes }) {
  const data = (["Entry", "Support", "Lurker", "Clutch", "Impacto"] as const).map((k) => ({ axis: k, value: Math.round(axes[k]) }));
  return (
    <div className="h-72 w-full" role="img" aria-label={`Perfil em percentis: ${data.map((d) => `${d.axis} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--grid)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.25} dot={{ r: 3, fill: "var(--accent)" }} isAnimationActive={false} />
          <Tooltip cursor={false} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { axis: string; value: number };
            return <Tip><b>{d.axis}: percentil {d.value}</b><br /><span className="text-ink-2">{AXIS_HELP[d.axis]}</span></Tip>;
          }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

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

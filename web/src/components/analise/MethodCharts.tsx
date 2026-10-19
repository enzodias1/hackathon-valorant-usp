"use client";
// Gráficos da página "Como funciona": calibração do modelo e chance de trade por distância.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ModelInfo } from "@/lib/types";
import { num, pct } from "@/lib/format";

const TICK = { fill: "var(--muted)", fontSize: 11 };
const pct0 = (v: number) => pct(v);

export function CalibrationChart({ data }: { data: ModelInfo["calibration"] }) {
  return (
    <div className="mx-auto aspect-square w-full max-w-md" role="img"
         aria-label={`Calibração: ${data.map((d) => `previsto ${pct(d.p)}, real ${pct(d.y)}`).join("; ")}`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 24, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis type="number" dataKey="p" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pct0} tick={TICK} tickLine={false}
                 axisLine={{ stroke: "var(--axis)" }} label={{ value: "Chance prevista pelo modelo", position: "bottom", offset: 6, fill: "var(--ink-2)", fontSize: 12 }} />
          <YAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pct0} tick={TICK} tickLine={false} axisLine={false} width={44}
                 label={{ value: "Vitórias de fato", angle: -90, position: "insideLeft", offset: 8, fill: "var(--ink-2)", fontSize: 12, style: { textAnchor: "middle" } }} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--muted)" strokeDasharray="4 4" ifOverflow="hidden" />
          <Tooltip cursor={{ stroke: "var(--axis)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as ModelInfo["calibration"][number];
            return (
              <Tip>
                Modelo previu <b>{pct(d.p)}</b> · o time venceu <b>{pct(d.y)}</b> das vezes<br />
                <span className="text-ink-2">{num(d.n)} momentos de round</span>
              </Tip>
            );
          }} />
          <Line dataKey="y" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TradeDistanceChart({ data }: { data: ModelInfo["trade_by_distance"] }) {
  return (
    <div className="h-80 w-full" role="img"
         aria-label={`Chance de a morte ser trocada por distância até o aliado mais próximo: ${data.map((d) => `${d.distance} ${pct(d.trade_rate)}`).join("; ")}`}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 20, left: 4 }} barCategoryGap={4}>
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis type="number" domain={[0, 0.45]} ticks={[0, 0.1, 0.2, 0.3, 0.4]} tickFormatter={pct0} tick={TICK} tickLine={false}
                 axisLine={{ stroke: "var(--axis)" }} label={{ value: "Mortes trocadas em até 5 s", position: "bottom", offset: 4, fill: "var(--ink-2)", fontSize: 12 }} />
          <YAxis type="category" dataKey="distance" tick={{ fill: "var(--ink-2)", fontSize: 12 }} tickLine={false} axisLine={false} width={64} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as ModelInfo["trade_by_distance"][number];
            return (
              <Tip>
                Aliado mais próximo a <b>{d.distance}</b><br />
                <b>{pct(d.trade_rate)}</b> das mortes foram trocadas <span className="text-ink-2">· {num(d.n)} mortes</span>
              </Tip>
            );
          }} />
          <Bar dataKey="trade_rate" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink shadow-lg">{children}</div>;
}

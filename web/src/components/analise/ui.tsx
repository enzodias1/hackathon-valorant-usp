// Blocos visuais compartilhados das telas de análise (Server Components: sem estado).
import Link from "next/link";
import type { Comparison, Insight, Insights } from "@/lib/types";
import { pct, pp } from "@/lib/format";

export function Section({ title, subtitle, children, id, aside }: { title: string; subtitle?: string; children: React.ReactNode; id?: string; aside?: React.ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Badge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
      {children}
    </span>
  );
}

export function Sig({ c }: { c: Pick<Comparison, "significant" | "good"> }) {
  if (!c.significant) return null;
  return c.good ? (
    <span className="text-good" aria-label="acima da liga">▲</span>
  ) : (
    <span className="text-bad" aria-label="abaixo da liga">▼</span>
  );
}

const INSIGHT_STYLE = {
  strengths: { icon: "✓", color: "text-good", title: "Pontos fortes" },
  weaknesses: { icon: "✕", color: "text-bad", title: "Pontos a melhorar" },
  attention: { icon: "!", color: "text-warn", title: "Atenção (tendência, ainda não conclusiva)" },
  notes: { icon: "i", color: "text-accent", title: "Leituras do perfil" },
} as const;

export function InsightPanel({ insights, empty }: { insights: Insights; empty?: string }) {
  const groups = (["strengths", "weaknesses", "attention", "notes"] as const).filter((k) => (insights[k] ?? []).length > 0);
  if (!groups.length)
    return <p className="text-sm text-ink-2">{empty ?? "Amostra pequena: nenhuma diferença em relação à liga é estatisticamente confiável ainda."}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((k) => (
        <div key={k}>
          <h3 className="mb-2 text-sm font-medium text-ink-2">{INSIGHT_STYLE[k].title}</h3>
          <ul className="space-y-2">
            {(insights[k] as Insight[]).map((i) => (
              <li key={i.key} className="flex gap-3 rounded-lg bg-surface-2 p-3">
                <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${INSIGHT_STYLE[k].color}`} aria-hidden>
                  {INSIGHT_STYLE[k].icon}
                </span>
                <div className="text-sm">
                  <p className="text-ink">{i.text}</p>
                  {i.tip && <p className="mt-1 text-ink-2">💡 {i.tip}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Ponto do time/jogador vs. traço da liga numa trilha 0–100%. */
export function CompareRow({ label, c, format = pct, domain = [0, 1], expectedLabel = "liga" }: {
  label: string; c: Comparison; format?: (x: number | null) => string; domain?: [number, number]; expectedLabel?: string;
}) {
  const pos = (x: number | null) => (x == null ? null : Math.min(100, Math.max(0, ((x - domain[0]) / (domain[1] - domain[0])) * 100)));
  const v = pos(c.value), l = pos(c.league);
  const dot = c.significant ? (c.good ? "bg-good" : "bg-bad") : "bg-ink-2";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-2 sm:grid-cols-[14rem_minmax(0,1fr)_9rem]">
      <div className="text-sm text-ink">{label}</div>
      <div className="relative h-5" title={`${format(c.value)} (${expectedLabel}: ${format(c.league)}) · n=${c.n}`}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-axis" />
        {l != null && <div className="absolute top-0.5 h-4 w-0.5 bg-muted" style={{ left: `calc(${l}% - 1px)` }} />}
        {v != null && <div className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-2 ring-surface ${dot}`} style={{ left: `calc(${v}% - 6px)` }} />}
      </div>
      <div className="tabular text-sm text-ink-2">
        <span className="text-ink">{format(c.value)}</span> <Sig c={c} /> <span className="text-muted">· {expectedLabel} {format(c.league)}</span>
      </div>
    </div>
  );
}

export function CompareLegend({ expectedLabel = "média da liga" }: { expectedLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-2">
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-ink-2" /> valor</span>
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-0.5 bg-muted" /> {expectedLabel}</span>
      <span className="flex items-center gap-1.5"><span className="text-good">▲</span> acima, com significância</span>
      <span className="flex items-center gap-1.5"><span className="text-bad">▼</span> abaixo, com significância</span>
    </div>
  );
}

/** Barra divergente para impacto em pp (verde positivo / vermelho negativo, sempre com sinal no texto). */
export function WpaBar({ value, max, digits = 1 }: { value: number; max: number; digits?: number }) {
  const w = Math.min(50, (Math.abs(value) / Math.max(max, 1e-9)) * 50);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 w-24 shrink-0">
        <div className="absolute inset-y-0 left-1/2 w-px bg-axis" />
        <div className={`absolute inset-y-0 rounded-sm ${value >= 0 ? "bg-good" : "bg-bad"}`}
             style={value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
      </div>
      <span className="tabular whitespace-nowrap text-sm text-ink">{pp(value, digits)}</span>
    </div>
  );
}

export function PercentileRow({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 py-1.5" title={hint}>
      <span className="text-sm text-ink-2">{label}</span>
      <div className="relative h-2 rounded-full bg-surface-2">
        {value != null && <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${value}%` }} />}
      </div>
      <span className="tabular text-right text-sm text-ink">{value == null ? "—" : `${Math.round(value)}`}</span>
    </div>
  );
}

export function TeamLink({ slug, name }: { slug: string; name: string }) {
  return <Link href={`/times/${slug}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink-2">{name}</Link>;
}

export function PlayerLink({ puuid, name }: { puuid: string; name: string }) {
  return <Link href={`/jogadores/${puuid}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink-2">{name}</Link>;
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`border-b border-line px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

export function Td({ children, right, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`border-b border-line/50 px-3 py-2 text-sm ${right ? "tabular text-right" : ""} ${className}`}>{children}</td>;
}

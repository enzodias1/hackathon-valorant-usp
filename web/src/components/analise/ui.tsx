// Blocos visuais compartilhados das telas de análise (Server Components; InfoTip é o único pedaço interativo).
import Link from "next/link";
import type { Comparison, Insight, Insights } from "@/lib/types";
import { betterThan, pct, pp } from "@/lib/format";
import InfoTip from "./InfoTip";

/**
 * Caixa de seção.
 * - `info`: explicação no botão "i" ao lado do título (prefira a `subtitle`, que ocupa a tela).
 * - `collapsible`: vira uma caixa expansível (<details>); `defaultOpen` define se começa aberta.
 * - `teaser`: prévia de uma linha mostrada no cabeçalho quando a caixa está fechada.
 */
export function Section({ title, subtitle, info, teaser, collapsible, defaultOpen, children, id, aside }: {
  title: string; subtitle?: string; info?: React.ReactNode; teaser?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
  children: React.ReactNode; id?: string; aside?: React.ReactNode;
}) {
  const heading = (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl tracking-wide text-ink">{title}</h2>
        {info && <InfoTip text={info} />}
      </div>
      {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</p>}
    </div>
  );
  const box = "min-w-0 scroll-mt-20 rounded-xl border border-line bg-surface";
  if (!collapsible) {
    return (
      <section id={id} data-pdf-section={title} className={`${box} p-5 sm:p-6`}>
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2">{heading}{aside}</header>
        {children}
      </section>
    );
  }
  return (
    <details id={id} data-pdf-section={title} open={defaultOpen} className={`${box} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:px-6 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          {heading}
          {teaser && <p className="mt-1 truncate text-sm text-ink-2 group-open:hidden">{teaser}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-3">
          {aside && <span className="hidden group-open:inline">{aside}</span>}
          <span aria-hidden data-print-hide className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-2 transition-[transform,color,border-color] group-open:rotate-180 group-hover:border-ink-2 group-hover:text-ink">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </span>
        </span>
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}

/** Faixa roxa de cabeçalho das páginas de detalhe (time, jogador, partida), com arte opcional à direita. */
/** Fundo de espreitadores (o ícone da habilidade da Fade) em cinza, repetido: faixas roxas sem arte e a capa e o fim da
 *  apresentação. Sai no PDF. */
export function ProwlerPattern() {
  return <div aria-hidden data-print-hide className="pointer-events-none absolute inset-0 -z-20 bg-[url('/art/prowler_tile.webp')] bg-[length:220px_220px] opacity-[0.14]" />;
}

export function PageBand({ back, kicker, title, children, actions, art, compact }: {
  back?: { href: string; label: string }; kicker?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode;
  actions?: React.ReactNode; art?: { portrait?: string; background?: string; splash?: string };
  /** título menor, para títulos de duas linhas (placar da partida) */
  compact?: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-brand">
      {!art && <ProwlerPattern />}
      {/* splash do mapa tingido de roxo (luminosidade da imagem + cor da faixa) e esmaecido do lado do texto */}
      {/* no PDF o splash e a arte de fundo saem (data-print-hide): a mistura de cores vira imagem pesada (~5 MB por arquivo) */}
      {art?.splash && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.splash} alt="" aria-hidden data-print-hide className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-40 mix-blend-luminosity" />
          <div aria-hidden data-print-hide className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-r from-brand from-25% via-brand/70 to-brand/10" />
        </>
      )}
      {/* arte oficial dos agentes (política "Legal Jibber Jabber" da Riot) */}
      {art?.background && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art.background} alt="" aria-hidden data-print-hide className="pointer-events-none absolute -top-8 right-[14%] -z-10 hidden h-[130%] opacity-[0.14] md:block" />
      )}
      {art?.portrait && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art.portrait} alt="" aria-hidden
             className="pointer-events-none absolute -top-[6%] right-[-14%] -z-10 h-[250%] opacity-25 [mask-image:linear-gradient(to_right,transparent_0%,black_35%)] md:right-[-4%] md:opacity-100" />
      )}
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-7 sm:px-8">
        {back && <Link href={back.href} data-print-hide className="label-caps text-[11px] text-white/70 hover:text-white">← {back.label}</Link>}
        {kicker && <div className="label-caps mt-4 text-[11px] text-lime">{kicker}</div>}
        {/* entrelinha 1,1: na Anton os acentos das maiúsculas (Ã, Ê) passam da altura da linha e encostariam na linha de cima */}
        <h1 className={`mt-1 max-w-3xl leading-[1.1] text-white ${compact ? "text-[clamp(1.9rem,4vw,3rem)]" : "text-[clamp(2.4rem,5.5vw,4.2rem)]"}`}>{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-white/85">{children}</div>}
        {actions && <div data-print-hide className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </section>
  );
}

/** Botões no estilo da identidade: principal (verde-limão) e secundário (contorno branco), para usar sobre a faixa roxa. */
export function BandButton({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return primary ? (
    <Link href={href} className="label-caps bg-lime px-5 py-3 text-[11px] text-bg transition-opacity [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)] hover:opacity-90">{children}</Link>
  ) : (
    <Link href={href} className="label-caps border-2 border-white/90 px-5 py-2.5 text-[11px] text-white transition-colors hover:bg-white hover:text-brand">{children}</Link>
  );
}

/** Título numerado no estilo da página inicial ("// 01" + título grande), com link opcional à direita. */
export function SectionHead({ n, title, link, info }: {
  n: string; title: string; link?: { href: string; label: string };
  /** botão "i" ao lado do título (ex.: <ChanceInfo />) */
  info?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="label-caps text-[10px] text-lime">{`// ${n}`}</p>
        <div className="mt-1 flex items-center gap-3">
          <h2 className="text-[clamp(2rem,4vw,3rem)] leading-[1.1] text-ink">{title}</h2>
          {info}
        </div>
      </div>
      {link && (
        <Link href={link.href} className="label-caps text-[11px] text-ink underline decoration-lime underline-offset-4 hover:text-lime">{link.label} →</Link>
      )}
    </div>
  );
}

export function StatTile({ label, value, sub, tone, info, infoAlign }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad";
  /** botão "i" ao lado do rótulo, com o que o número significa */
  info?: React.ReactNode; infoAlign?: "left" | "right";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">{label}{info && <InfoTip text={info} label={`O que é ${label.toLowerCase()}`} align={infoAlign} />}</div>
      <div className={`font-display mt-1 text-3xl tracking-wide ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

/** Definições dentro de um "i": o termo em destaque e o que ele quer dizer, uma por linha (ver lib/glossary). */
export function TermList({ terms, className = "mt-2" }: { terms: [string, string][]; className?: string }) {
  return (
    <span className={`block space-y-1.5 ${className}`}>
      {terms.map(([term, def]) => <span key={term} className="block"><b className="text-ink">{term}:</b> {def}</span>)}
    </span>
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
  neutral_pos: { icon: "+", color: "text-muted", title: "Onde mais se destaca (sem confirmação)" },
  weaknesses: { icon: "✕", color: "text-bad", title: "Pontos a melhorar" },
  neutral: { icon: "–", color: "text-muted", title: "Onde tem menos folga (sem confirmação)" },
  attention: { icon: "!", color: "text-warn", title: "Atenção (tendência, ainda não conclusiva)" },
  notes: { icon: "i", color: "text-accent", title: "Leituras do perfil" },
} as const;

export function InsightPanel({ insights, empty }: { insights: Insights; empty?: string }) {
  // os grupos "neutros" ocupam o lugar dos pontos fortes / a melhorar quando nada foi confirmado (não aparecem junto com eles)
  const groups = (["strengths", "neutral_pos", "weaknesses", "neutral", "attention", "notes"] as const).filter((k) => (insights[k] ?? []).length > 0);
  if (!groups.length)
    return <p className="text-sm text-ink-2">{empty ?? "Nenhuma diferença em relação à liga passou no teste estatístico: nas métricas analisadas, o desempenho está dentro da faixa normal da liga (ou a amostra ainda é pequena para afirmar)."}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((k) => (
        <div key={k}>
          <h3 className="mb-2 text-sm font-medium text-ink-2">{INSIGHT_STYLE[k].title}</h3>
          <ul className="space-y-2">
            {(insights[k] as Insight[]).map((i) => i.key === "intro" ? (
              <li key={i.key} className="text-sm text-ink-2">{i.text}</li>
            ) : (
              <li key={i.key} className="flex gap-3 rounded-lg bg-surface-2 p-3">
                <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${INSIGHT_STYLE[k].color}`} aria-hidden>
                  {INSIGHT_STYLE[k].icon}
                </span>
                <div className="text-sm">
                  <p className="text-ink">{i.text}</p>
                  {i.tip && <p className="mt-1 text-ink-2">{i.tip}</p>}
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

/** Barra divergente para impacto em pontos de chance de vitória (verde positivo / vermelho negativo, sempre com sinal no texto). */
export function WpaBar({ value, max, digits = 1, compact }: { value: number; max: number; digits?: number; compact?: boolean }) {
  const w = Math.min(50, (Math.abs(value) / Math.max(max, 1e-9)) * 50);
  return (
    <div className="flex items-center gap-2">
      <div className={`relative h-2.5 shrink-0 ${compact ? "w-12 sm:w-16" : "w-12 sm:w-24"}`}>
        <div className="absolute inset-y-0 left-1/2 w-px bg-axis" />
        <div className={`absolute inset-y-0 rounded-sm ${value >= 0 ? "bg-good" : "bg-bad"}`}
             style={value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
      </div>
      <span className="tabular whitespace-nowrap text-sm text-ink">
        {compact ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: digits })}` : pp(value, digits)}
      </span>
    </div>
  );
}

/** Efeito estimado (ponto) com intervalo de 90% (traço) num eixo simétrico em torno de zero. */
export function EffectRow({ label, sub, effect, ci, domain = 1.5, unit = "round", highlight }: {
  label: string; sub?: string; effect: number | null; ci?: [number, number]; domain?: number; unit?: string; highlight?: boolean;
}) {
  const pos = (x: number) => Math.min(100, Math.max(0, 50 + (x / domain) * 50));
  const sig = ci ? ci[0] > 0 || ci[1] < 0 : false;
  const color = !sig ? "bg-ink-2" : (effect ?? 0) > 0 ? "bg-good" : "bg-bad";
  const fmt = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2 sm:grid-cols-[13rem_minmax(0,1fr)_11rem] ${highlight ? "bg-surface-2" : ""}`}>
      <div>
        <div className="text-sm text-ink">{label}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      <div className="relative h-6" title={effect == null ? "referência" : `${fmt(effect)} ${unit}${ci ? ` (90%: ${fmt(ci[0])} a ${fmt(ci[1])})` : ""}`}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-axis" />
        <div className="absolute top-0 h-6 w-px bg-muted" style={{ left: "50%" }} />
        {ci && <div className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${color} opacity-50`} style={{ left: `${pos(ci[0])}%`, width: `${pos(ci[1]) - pos(ci[0])}%` }} />}
        {effect != null && <div className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-2 ring-surface ${color}`} style={{ left: `calc(${pos(effect)}% - 6px)` }} />}
      </div>
      <div className="tabular text-sm text-ink-2">
        {effect == null ? <span className="text-muted">referência (0)</span> : (
          <><span className="text-ink">{fmt(effect)} {unit}</span>{ci && <span className="text-muted"> · {fmt(ci[0])} a {fmt(ci[1])}</span>}</>
        )}
      </div>
    </div>
  );
}

/** Uma etapa do campeonato: desempenho acima/abaixo do próprio nível, com faixa de incerteza (90%). */
export function StageRow({ label, sub, value, se, domain = 25 }: { label: string; sub?: string; value: number; se: number; domain?: number }) {
  const pos = (x: number) => Math.min(100, Math.max(0, 50 + (x / domain) * 50));
  // barra neutra de propósito: cada etapa isolada não passa por controle de falsos positivos;
  // as afirmações de mudança ficam na lista "O que mudou" (já com Benjamini-Hochberg)
  const lo = value - 1.645 * se, hi = value + 1.645 * se;
  const fmt = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}`;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-2 sm:grid-cols-[15rem_minmax(0,1fr)_9rem]">
      <div>
        <div className="text-sm text-ink">{label}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      <div className="relative h-6" title={`${fmt(value)} rounds a cada 100 (90%: ${fmt(lo)} a ${fmt(hi)})`}>
        <div className="absolute top-0 h-6 w-px bg-muted" style={{ left: "50%" }} />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink-2 opacity-30" style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }} />
        <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-ink-2"
             style={value >= 0 ? { left: "50%", width: `${pos(value) - 50}%` } : { right: "50%", width: `${50 - pos(value)}%` }} />
      </div>
      <div className="tabular text-sm"><span className="text-ink">{fmt(value)}</span> <span className="text-muted">± {Math.abs(1.645 * se).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span></div>
    </div>
  );
}

/** Posição na liga numa estatística: a barra vai de 0 (pior da liga) a 100 (melhor) e o texto diz "melhor que X%". */
export function PercentileRow({ label, value, hint, rank }: { label: string; value: number | null; hint?: string; rank?: number | null }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)_8.5rem] items-center gap-3 py-1.5" title={hint}>
      <span className="text-sm text-ink-2">{label}</span>
      <div className="relative h-2 rounded-full bg-surface-2">
        {value != null && <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${value}%` }} />}
      </div>
      <span className="tabular text-right text-sm text-ink">{betterThan(value, "", rank)}</span>
    </div>
  );
}

export function TeamLink({ slug, name }: { slug: string; name: string }) {
  return <Link href={`/times/${slug}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink-2">{name}</Link>;
}

export function PlayerLink({ puuid, name }: { puuid: string; name: string }) {
  return <Link href={`/jogadores/${puuid}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink-2">{name}</Link>;
}

export function Th({ children, right, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <th className={`border-b border-line px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted sm:px-3 ${right ? "text-right" : "text-left"} ${className}`}>{children}</th>;
}

export function Td({ children, right, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`border-b border-line/50 px-2 py-2 text-sm sm:px-3 ${right ? "tabular text-right" : ""} ${className}`}>{children}</td>;
}

// Formatação padrão (pt-BR) para todo o site.

export const pct = (x: number | null | undefined, digits = 0) =>
  x == null || Number.isNaN(x) ? "—" : `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;

/** Chance de vitória sem arredondar para 0% ou 100% o que não é certo: uma casa decimal perto dos extremos (0,4%, 99,6%) e,
 *  além disso, "menos de 0,1%" / "mais de 99,9%" ("<0,1%" / ">99,9%" na forma curta). 0 e 1 exatos são round decidido. */
export const chance = (x: number, short = false) => {
  if (x > 0 && x < 0.001) return short ? "<0,1%" : "menos de 0,1%";
  if (x > 0.999 && x < 1) return short ? ">99,9%" : "mais de 99,9%";
  return pct(x, x < 0.01 || (x > 0.99 && x < 1) ? 1 : 0);
};

/** impacto em pontos (percentuais) de chance de vitória, com sinal: "+12,3 pontos", "−1,5 ponto" */
export const pp = (x: number | null | undefined, digits = 1) => {
  if (x == null || Number.isNaN(x)) return "—";
  const v = Number(Math.abs(x).toFixed(digits));
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${v < 2 ? "ponto" : "pontos"}`;
};

export const num = (x: number | null | undefined, digits = 0) =>
  x == null || Number.isNaN(x) ? "—" : x.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const date = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/** "Nick#TAG" -> "Nick" */
export const nick = (name: string | null | undefined) => (name ?? "?").split("#")[0];

/** ms desde o início do round -> "1:23" */
export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const RESULT_PT: Record<string, string> = {
  Elimination: "Eliminação",
  Defuse: "Desarme",
  Detonate: "Explosão",
  Timer: "Tempo esgotado",
};

export const competitionLabel = (competition: string, stage: string | null) => (stage ? `${competition} · ${stage}` : competition);

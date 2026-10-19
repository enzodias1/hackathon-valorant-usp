"use client";
// Conselheiro de economia: escolha a situação e compare economizar, meia compra e forçar, com dados reais da liga.
import { useState } from "react";
import type { EcoDecision, Economy } from "@/lib/types";
import { num, pct } from "@/lib/format";
import { EffectRow } from "./ui";

const DECISIONS: EcoDecision[] = ["Economizar", "Meio-termo", "Forçar"];
const CONTEXT_LABEL: Record<string, string> = {
  "perdeu o pistol": "Perdemos o pistol",
  "perdeu o round anterior": "Perdemos um round e não dá para full buy",
};
const fmt2 = (x: number | null | undefined) => (x == null ? "—" : x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${fmt2(Math.abs(x))}`;

export default function EconomyAdvisor({ economy }: { economy: Economy }) {
  const contexts = Object.keys(economy.contexts);
  const [ctx, setCtx] = useState(contexts[0]);
  const c = economy.contexts[ctx];
  const def = economy.definitions;
  const best = (Object.entries(c.adjusted_vs_save) as [EcoDecision, { effect: number; ci90: [number, number]; significant: boolean }][])
    .filter(([, e]) => e.significant && e.effect > 0).sort((a, b) => b[1].effect - a[1].effect)[0];
  const describe: Record<EcoDecision, string> = {
    Economizar: `gasta até ${pct(def.save_max_spent_share)} do dinheiro`,
    "Meio-termo": `gasta entre ${pct(def.save_max_spent_share)} e ${pct(def.force_min_spent_share)}`,
    Forçar: `gasta ${pct(def.force_min_spent_share)} ou mais`,
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Situação" className="flex flex-wrap gap-2">
        {contexts.map((k) => (
          <button key={k} role="tab" aria-selected={k === ctx} onClick={() => setCtx(k)}
                  className={`rounded-lg border px-4 py-2 text-sm transition ${k === ctx ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2 hover:border-ink-2"}`}>
            {CONTEXT_LABEL[k] ?? k}
          </button>
        ))}
      </div>

      {best && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">O que os dados indicam</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{best[0] === "Forçar" ? "Forçar" : "Meia compra"} <span className="text-good">{signed(best[1].effect)} round</span></p>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Em situações parecidas, quem {best[0] === "Forçar" ? "forçou" : "fez meia compra"} venceu em média {signed(best[1].effect)} round a mais
            nos {def.horizon_rounds} rounds seguintes do que quem economizou (intervalo de 90%: {signed(best[1].ci90[0])} a {signed(best[1].ci90[1])}).
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {DECISIONS.map((d) => {
          const x = c.decisions[d];
          if (!x) return null;
          return (
            <div key={d} className={`rounded-xl border bg-surface p-4 ${best?.[0] === d ? "border-good" : "border-line"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-ink">{d}</h3>
                <span className="text-xs text-muted">{x.n} situações</span>
              </div>
              <p className="text-xs text-muted">{describe[d]}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-2">Vence o próprio round</dt><dd className="tabular text-ink">{pct(x.win_now)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">Rounds vencidos nos {def.horizon_rounds} seguintes</dt><dd className="tabular text-ink">{fmt2(x.rounds_next3)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">Full buy no round seguinte</dt><dd className="tabular text-ink">{pct(x.next_full_buy)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">Dinheiro médio do time</dt><dd className="tabular text-ink">{num(x.avg_credits)}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <h3 className="font-semibold text-ink">Comparando situações parecidas</h3>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Diferença em rounds vencidos nos {def.horizon_rounds} rounds seguintes, em relação a economizar, descontando: {def.controls.join(", ")}.
          O traço é o intervalo de 90%. Se ele cruza o zero, a diferença não é conclusiva.
        </p>
        <div className="mt-3">
          <EffectRow label="Economizar" sub="referência" effect={null} />
          {(["Meio-termo", "Forçar"] as EcoDecision[]).map((d) => {
            const e = c.adjusted_vs_save[d];
            return e ? <EffectRow key={d} label={d} sub={describe[d]} effect={e.effect} ci={e.ci90} highlight={best?.[0] === d} /> : null;
          })}
        </div>
      </div>

      <details className="rounded-xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold text-ink">O resultado se sustenta? (testes de robustez)</summary>
        <p className="mt-2 max-w-3xl text-sm text-ink-2">A mesma comparação refeita de outros jeitos. Se a conclusão mudasse de sinal, não a mostraríamos como recomendação.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">Variação</th><th className="py-2 pr-3 text-right">Situações</th><th className="py-2 pr-3 text-right">Meia compra</th><th className="py-2 text-right">Forçar</th></tr></thead>
            <tbody>
              {Object.entries(c.robustness).map(([name, r]) => (
                <tr key={name} className="border-t border-line/50">
                  <td className="py-2 pr-3 text-ink">{name}</td>
                  <td className="tabular py-2 pr-3 text-right text-ink-2">{r.n}</td>
                  {(["Meio-termo", "Forçar"] as EcoDecision[]).map((d) => {
                    const e = r.effects[d];
                    return (
                      <td key={d} className="tabular py-2 pr-3 text-right">
                        {e ? <><span className={e.significant ? (e.effect > 0 ? "text-good" : "text-bad") : "text-ink-2"}>{signed(e.effect)}</span> <span className="text-muted">[{signed(e.ci90[0])}; {signed(e.ci90[1])}]</span></> : <span className="text-muted">poucos casos</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">“Só o próprio round” mede a variação na chance de vencer o round da compra (0,35 = 35 pontos percentuais).</p>
      </details>
    </div>
  );
}

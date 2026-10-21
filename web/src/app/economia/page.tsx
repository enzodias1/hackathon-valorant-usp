import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { getEconomy } from "@/lib/data";
import { num } from "@/lib/format";
import EconomyAdvisor from "@/components/analise/EconomyAdvisor";

export const metadata: Metadata = pageMeta("Forçar ou economizar? · Analista UNIVAVÁ", "Sem dinheiro para full buy, qual decisão rende mais rounds? A resposta tirada de situações reais do UNIVAVÁ e da Rush Series.");

export default async function EconomyPage() {
  const economy = await getEconomy();
  const total = Object.values(economy.contexts).reduce((s, c) => s + c.n, 0);
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Conselheiro de economia</p>
        <h1 className="text-3xl font-bold text-ink">Forçar ou economizar?</h1>
        <p className="text-ink-2">
          Quando o time não tem dinheiro para full buy, qual decisão rende mais rounds? Analisamos {num(total)} situações reais do UNIVAVÁ e
          da Rush Series e comparamos o que aconteceu nos rounds seguintes com cada escolha, descontando dinheiro, armas, adversário,
          força dos times, lado e placar.
        </p>
      </header>

      <EconomyAdvisor economy={economy} />

      <section className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-2">
        <h2 className="mb-2 font-semibold text-ink">Como ler com cuidado</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>São dados observados, não um experimento: os times decidem por motivos que nem sempre aparecem nos dados (leitura do adversário, confiança, plano tático).</li>
          <li>Por isso testamos a conclusão de vários jeitos (veja os testes de robustez acima) e só a mostramos como recomendação quando ela se mantém em todos.</li>
          <li>Os números valem para o cenário universitário destes campeonatos; o profissional pode se comportar diferente.</li>
        </ul>
        <p className="mt-3">Quer ver as decisões do seu time? Abra a página do time em <Link href="/times" className="text-accent hover:underline">Times</Link>, na seção “Forçar ou economizar?”.</p>
      </section>
    </main>
  );
}

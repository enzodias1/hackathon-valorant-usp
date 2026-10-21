import Link from "next/link";
import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Página não encontrada · ${PRODUCT_NAME}` };

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/times", label: "Times" },
  { href: "/partidas", label: "Partidas" },
];

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-20">
      <p className="tabular text-sm font-medium uppercase tracking-wide text-accent">Erro 404</p>
      <h1 className="text-3xl font-bold text-ink">Essa página não existe.</h1>
      <p className="max-w-xl text-ink-2">
        O link pode estar errado ou a partida, o time ou o jogador não faz parte da base (UNIVAVÁ e Rush Series). Tente começar por aqui:
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        {LINKS.map((l, i) => (
          <Link key={l.href} href={l.href}
                className={i === 0 ? "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
                                   : "rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2"}>
            {l.label}
          </Link>
        ))}
      </div>
    </main>
  );
}

"use client";
// Cabeçalho fixo do site: nome do produto + navegação principal (destaca a seção atual).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_NAME } from "@/lib/site";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/partidas", label: "Partidas" },
  { href: "/times", label: "Times" },
  { href: "/jogadores", label: "Jogadores" },
  { href: "/economia", label: "Economia" },
  { href: "/comparar", label: "Comparar" },
];

export default function Header() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm font-bold text-bg" aria-hidden>A</span>
          {PRODUCT_NAME}
        </Link>
        <nav aria-label="Navegação principal">
          <ul className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                      className={`rounded-md px-3 py-1.5 transition-colors ${active(n.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink"}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

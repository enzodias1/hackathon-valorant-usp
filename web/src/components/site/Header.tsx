"use client";
// Cabeçalho fixo do site: nome do produto + navegação principal (destaca a seção atual).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRODUCT_NAME } from "@/lib/site";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/partidas", label: "Partidas" },
  { href: "/times", label: "Times" },
  { href: "/jogadores", label: "Jogadores" },
  { href: "/economia", label: "Economia" },
  { href: "/comparar", label: "Comparar" },
  { href: "/como-funciona", label: "Como funciona" },
];

export default function Header() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  // no celular o menu rola de lado: esmaece a borda direita enquanto houver itens escondidos e mostra o link ativo
  const nav = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  const check = () => {
    const el = nav.current;
    if (el) setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [path]);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm font-bold text-bg" aria-hidden>A</span>
          {PRODUCT_NAME}
        </Link>
        <nav ref={nav} onScroll={check} aria-label="Navegação principal"
             className={`-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-auto md:px-0 ${more ? "[mask-image:linear-gradient(to_right,black_80%,transparent)]" : ""}`}>
          <ul className="flex w-max gap-1 pr-4 text-sm md:pr-0">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                      className={`block whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${active(n.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink"}`}>
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

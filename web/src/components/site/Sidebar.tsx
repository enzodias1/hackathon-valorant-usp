"use client";
// Menu lateral fixo (desktop) e gaveta com botão ☰ (celular). Destaca a seção atual.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/partidas", label: "Partidas" },
  { href: "/times", label: "Times" },
  { href: "/jogadores", label: "Jogadores" },
  { href: "/comparar", label: "Comparar" },
  { href: "/destaques", label: "Destaques" },
  { href: "/como-funciona", label: "Como usar" },
];
// para a banca técnica: discreto, abaixo dos itens principais
const NAV_SECONDARY = [{ href: "/metodologia", label: "Metodologia" }, { href: "/apresentacao", label: "Apresentação" }];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Analista UNIVAVÁ: início">
      <span className="font-display text-2xl uppercase leading-none tracking-wide text-ink">Analista</span>
      <span className="rounded-[3px] bg-lime px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-bg">Univavá</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link href={n.href} onClick={onNavigate} aria-current={active(n.href) ? "page" : undefined}
                  className={`label-caps relative flex items-center rounded-md px-3 py-2.5 transition-colors ${
                    active(n.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink"}`}>
              {active(n.href) && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-lime" aria-hidden />}
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-4 border-t border-line pt-4">
        {NAV_SECONDARY.map((n) => (
          <li key={n.href}>
            <Link href={n.href} onClick={onNavigate} aria-current={active(n.href) ? "page" : undefined}
                  className={`label-caps flex items-center gap-2 rounded-md px-3 py-2 text-[10px] transition-colors ${
                    active(n.href) ? "text-lime" : "text-muted hover:text-ink"}`}>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* desktop: barra lateral fixa */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg px-4 py-6 lg:flex">
        <Logo />
        <nav aria-label="Navegação principal" className="mt-10 flex-1"><NavList /></nav>
        <p className="label-caps px-3 text-[10px] leading-relaxed text-muted">Dados · Univavá + Rush Series · 2026</p>
      </aside>

      {/* celular: barra no topo + gaveta */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}
                className="grid h-9 w-9 place-items-center rounded-md border border-line text-ink">
          <span aria-hidden className="text-lg leading-none">☰</span>
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-line bg-bg px-4 py-5">
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="grid h-9 w-9 place-items-center rounded-md border border-line text-ink">✕</button>
            </div>
            <nav aria-label="Navegação principal" className="mt-8"><NavList onNavigate={() => setOpen(false)} /></nav>
          </div>
        </div>
      )}
    </>
  );
}

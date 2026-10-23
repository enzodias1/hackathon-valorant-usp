"use client";
// Menu lateral fixo (desktop) e gaveta com botão ☰ (celular). Destaca a seção atual.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import QuickSearch from "./QuickSearch";
import { PRODUCT_NAME } from "@/lib/site";

// ícones de traço (16 × 16), na cor do texto do item
const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H9.5V10h-3v3.5H3a.5.5 0 0 1-.5-.5z" />,
  matches: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="m7 6 3 2-3 2z" /></>,
  teams: <path d="M8 2 3 4v4c0 3 2.2 5 5 6 2.8-1 5-3 5-6V4z" />,
  players: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 14c.6-2.8 2.6-4.2 5-4.2s4.4 1.4 5 4.2" /></>,
  compareTeams: <path d="M3 5.5h9m0 0L9.5 3M12 5.5 9.5 8M13 10.5H4m0 0L6.5 8M4 10.5 6.5 13" />,
  comparePlayers: <><circle cx="5.5" cy="6" r="2" /><circle cx="10.5" cy="6" r="2" /><path d="M1.5 13c.4-2 1.9-3 4-3s3.6 1 4 3M10.5 10c2.1 0 3.6 1 4 3" /></>,
  highlights: <path d="m8 2 1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13.1l.7-4L2.2 6.3l4-.6z" />,
  method: <><path d="M6 2.5h4M6.8 2.5v3.8L3.2 12.3a.9.9 0 0 0 .8 1.2h8a.9.9 0 0 0 .8-1.2L9.2 6.3V2.5" /><path d="M4.8 9.5h6.4" /></>,
  slides: <><rect x="2" y="2.5" width="12" height="8.5" rx="1" /><path d="M8 11v2.5M5.5 13.5h5" /></>,
};

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
const GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [{ href: "/inicio", label: "Início", icon: "home" }] },
  { label: "Análises", items: [
    { href: "/partidas", label: "Partidas", icon: "matches" },
    { href: "/times", label: "Times", icon: "teams" },
    { href: "/jogadores", label: "Jogadores", icon: "players" },
  ] },
  { label: "Ferramentas", items: [
    { href: "/comparar", label: "Comparar times", icon: "compareTeams" },
    { href: "/comparar/jogadores", label: "Comparar jogadores", icon: "comparePlayers" },
    { href: "/destaques", label: "Destaques", icon: "highlights" },
  ] },
  { label: "Sobre o projeto", items: [
    { href: "/metodologia", label: "Metodologia", icon: "method" },
    { href: "/", label: "Apresentação", icon: "slides" },
  ] },
];

function Logo() {
  return (
    <Link href="/inicio" className="flex items-center gap-2" aria-label={`${PRODUCT_NAME}: início`}>
      <span className="font-display text-2xl uppercase leading-none tracking-wide text-ink">{PRODUCT_NAME}</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  // "/comparar" não acende em "/comparar/jogadores"; a raiz só nela mesma
  const active = (href: string) => (href === "/" || href === "/comparar" ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((g, gi) => (
        <div key={gi}>
          {g.label && <p className="label-caps mb-1 px-3 text-[10px] text-muted">{g.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={onNavigate} aria-current={active(n.href) ? "page" : undefined}
                      className={`label-caps relative flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[11px] tracking-[0.08em] transition-colors ${
                        active(n.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink"}`}>
                  {active(n.href) && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-lime" aria-hidden />}
                  <svg viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 ${active(n.href) ? "text-lime" : "text-muted"}`} fill="none" stroke="currentColor"
                       strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[n.icon]}</svg>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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

  // a apresentação (raiz) ocupa a tela inteira, sem o menu
  if (path === "/") return null;

  return (
    <>
      {/* desktop: barra lateral fixa */}
      <aside data-print-hide className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg px-4 py-6 lg:flex">
        <Logo />
        <div className="mt-6"><QuickSearch hotkey /></div>
        <nav aria-label="Navegação principal" className="mt-6 flex-1 overflow-y-auto"><NavList /></nav>
        <p className="label-caps px-3 text-[10px] leading-relaxed text-muted">Dados · Univavá + Rush Series · 2026</p>
      </aside>

      {/* celular: barra no topo + gaveta */}
      <header data-print-hide className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
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
            <div className="mt-5"><QuickSearch onNavigate={() => setOpen(false)} /></div>
            <nav aria-label="Navegação principal" className="mt-6"><NavList onNavigate={() => setOpen(false)} /></nav>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
// Busca rápida no menu: digite parte do nome de um time, jogador ou partida (ex.: "ufmt mack", "darnubra", "lotus") e vá direto
// para a página. Lê /data/index.json só quando o campo recebe foco. Ctrl+K ou "/" focam o campo; setas escolhem, Enter abre.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DataIndex } from "@/lib/types";
import { competitionLabel, date, nick } from "@/lib/format";

type Hit = { kind: "Times" | "Jogadores" | "Partidas"; href: string; label: string; sub: string; hay: string; key: string; rank: number };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LIMIT = { Times: 5, Jogadores: 6, Partidas: 5 } as const;

function buildEntries(ix: DataIndex): Hit[] {
  const teamName = (slug: string) => ix.teams[slug]?.name ?? slug;
  const teams: Hit[] = Object.entries(ix.teams).map(([slug, t]) => ({
    kind: "Times", href: `/times/${slug}`, label: t.name, sub: t.institution ?? "", key: fold(t.name),
    hay: fold(`${t.name} ${t.tag} ${t.institution ?? ""} ${slug}`), rank: 0,
  }));
  const players: Hit[] = ix.players.map((p) => ({
    kind: "Jogadores", href: `/jogadores/${p.puuid}`, label: nick(p.name), sub: [teamName(p.team), p.agent_role].filter(Boolean).join(" · "),
    key: fold(nick(p.name)), hay: fold(`${p.name} ${teamName(p.team)}`), rank: 0,
  }));
  const matches: Hit[] = [...ix.matches].sort((a, b) => b.date.localeCompare(a.date)).map((m) => ({
    kind: "Partidas", href: `/partidas/${m.id}`,
    label: `${teamName(m.red)} ${m.score.Red} × ${m.score.Blue} ${teamName(m.blue)}`,
    sub: `${m.map} · ${date(m.date)} · ${competitionLabel(m.competition, m.stage)}`, key: fold(`${teamName(m.red)} ${teamName(m.blue)}`),
    hay: fold(`${teamName(m.red)} ${teamName(m.blue)} ${ix.teams[m.red]?.tag ?? ""} ${ix.teams[m.blue]?.tag ?? ""} ${m.map} ${m.competition} ${m.stage ?? ""}`), rank: 0,
  }));
  return [...teams, ...players, ...matches];
}

export default function QuickSearch({ hotkey = false, onNavigate }: { hotkey?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Hit[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);

  const load = () => {
    if (entries) return;
    fetch("/data/index.json").then((r) => r.json()).then((ix: DataIndex) => setEntries(buildEntries(ix))).catch(() => setEntries([]));
  };

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const hits = useMemo(() => {
    const words = fold(q).trim().split(/\s+/).filter(Boolean);
    if (!entries || !words.length) return [];
    const out: Hit[] = [];
    for (const kind of ["Times", "Jogadores", "Partidas"] as const) {
      const found = entries.filter((e) => e.kind === kind && words.every((w) => e.hay.includes(w)))
        // começa com o que foi digitado > alguma palavra começa > aparece no meio
        .map((e) => ({ ...e, rank: e.key.startsWith(words[0]) ? 0 : new RegExp(`(^|\\s)${words[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(e.key) ? 1 : 2 }))
        .sort((a, b) => a.rank - b.rank || (kind === "Partidas" ? 0 : a.label.localeCompare(b.label, "pt-BR")));
      out.push(...found.slice(0, LIMIT[kind]));
    }
    return out;
  }, [entries, q]);

  useEffect(() => setSel(0), [q]);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    onNavigate?.();
    router.push(h.href);
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm focus-within:border-ink-2">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <span className="sr-only">Buscar time, jogador ou partida</span>
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
               onFocus={() => { load(); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
               onKeyDown={(e) => {
                 if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
                 else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
                 else if (e.key === "Enter" && hits[sel]) { e.preventDefault(); go(hits[sel]); }
                 else if (e.key === "Escape") { setQ(""); input.current?.blur(); }
               }}
               placeholder="Buscar…" aria-label="Buscar time, jogador ou partida" aria-autocomplete="list"
               className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted focus:outline-none" />
        {hotkey && !q && <kbd className="hidden rounded border border-line px-1 text-[10px] text-muted xl:inline">Ctrl K</kbd>}
      </label>

      {open && q.trim() && (
        <div role="listbox" aria-label="Resultados da busca"
             className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line bg-surface-2 py-1 shadow-2xl">
          {!entries ? <p className="px-3 py-2 text-sm text-ink-2">Carregando…</p>
            : !hits.length ? <p className="px-3 py-2 text-sm text-ink-2">Nada encontrado para “{q}”.</p>
            : hits.map((h, i) => (
              <div key={h.href}>
                {(i === 0 || hits[i - 1].kind !== h.kind) && <p className="label-caps px-3 pb-1 pt-2 text-[10px] text-muted">{h.kind}</p>}
                <Link href={h.href} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); go(h); }} onMouseEnter={() => setSel(i)}
                      className={`block px-3 py-1.5 ${i === sel ? "bg-surface text-ink" : "text-ink-2"}`}>
                  <span className="block truncate text-sm text-ink">{h.label}</span>
                  {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
                </Link>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

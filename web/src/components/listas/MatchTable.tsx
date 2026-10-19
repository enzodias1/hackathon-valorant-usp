"use client";
// Lista de partidas com filtros por competição, time e mapa. Cada linha leva para /partidas/<id>.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { competitionLabel, date } from "@/lib/format";
import type { Color } from "@/lib/types";
import { Td, Th } from "@/components/analise/ui";
import { ResultCount, SelectFilter, useUrlFilters } from "./controls";

export interface MatchRow {
  id: string;
  date: string;
  competition: string;
  stage: string | null;
  map: string;
  red: { slug: string; name: string };
  blue: { slug: string; name: string };
  score: Record<Color, number>;
  winner: Color;
}

const KEYS = ["competicao", "time", "mapa"] as const;

const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "pt-BR"));

export default function MatchTable({ rows }: { rows: MatchRow[] }) {
  const router = useRouter();
  const { filters, set, clear } = useUrlFilters(KEYS);

  const options = useMemo(() => {
    const teams = new Map<string, string>();
    for (const r of rows) {
      teams.set(r.red.slug, r.red.name);
      teams.set(r.blue.slug, r.blue.name);
    }
    // competição inteira ("Univavá") e cada fase ("Univavá · Classificatória 1"); o valor é o próprio rótulo
    const competicao: { value: string; label: string }[] = [];
    for (const c of uniq(rows.map((r) => r.competition))) {
      const stages = uniq(rows.filter((r) => r.competition === c && r.stage).map((r) => r.stage as string));
      competicao.push({ value: c, label: stages.length ? `${c} (todas as fases)` : c });
      for (const s of stages) competicao.push({ value: competitionLabel(c, s), label: `${c} · ${s}` });
    }
    return {
      competicao,
      time: [...teams].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      mapa: uniq(rows.map((r) => r.map)).map((m) => ({ value: m, label: m })),
    };
  }, [rows]);

  const shown = rows.filter((r) =>
    (!filters.competicao || r.competition === filters.competicao || competitionLabel(r.competition, r.stage) === filters.competicao) &&
    (!filters.time || r.red.slug === filters.time || r.blue.slug === filters.time) &&
    (!filters.mapa || r.map === filters.mapa));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectFilter label="Competição" value={filters.competicao} onChange={(v) => set("competicao", v)} options={options.competicao} all="Todas" />
        <SelectFilter label="Time" value={filters.time} onChange={(v) => set("time", v)} options={options.time} />
        <SelectFilter label="Mapa" value={filters.mapa} onChange={(v) => set("mapa", v)} options={options.mapa} />
      </div>
      <ResultCount shown={shown.length} total={rows.length} noun="partidas" onClear={clear} />

      {/* celular: cartões; a partir de sm: tabela */}
      <ul className="divide-y divide-line/50 rounded-xl border border-line bg-surface sm:hidden">
        {shown.map((r) => (
          <li key={r.id}>
            <Link href={`/partidas/${r.id}`} className="block px-4 py-3 hover:bg-surface-2">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm">
                <span className={r.winner === "Red" ? "font-semibold text-ink" : "text-ink-2"}>{r.red.name}</span>
                <span className="tabular rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-ink">{r.score.Red} <span className="text-muted">–</span> {r.score.Blue}</span>
                <span className={`text-right ${r.winner === "Blue" ? "font-semibold text-ink" : "text-ink-2"}`}>{r.blue.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{date(r.date)} · {competitionLabel(r.competition, r.stage)} · {r.map}</p>
            </Link>
          </li>
        ))}
        {!shown.length && <li className="px-4 py-8 text-center text-sm text-ink-2">Nenhuma partida com esses filtros.</li>}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface sm:block">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Competição</Th>
              <Th>Mapa</Th>
              <Th right>Time</Th>
              <th className="border-b border-line px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted">Placar</th>
              <Th>Time</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} onClick={() => router.push(`/partidas/${r.id}`)} className="cursor-pointer hover:bg-surface-2">
                <Td className="tabular whitespace-nowrap text-ink-2">{date(r.date)}</Td>
                <Td className="text-ink-2">{competitionLabel(r.competition, r.stage)}</Td>
                <Td className="text-ink">{r.map}</Td>
                <Td right className={r.winner === "Red" ? "font-semibold text-ink" : "text-ink-2"}>{r.red.name}</Td>
                <Td className="text-center">
                  <Link href={`/partidas/${r.id}`} onClick={(e) => e.stopPropagation()}
                        className="tabular whitespace-nowrap rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-ink hover:bg-axis"
                        aria-label={`${r.red.name} ${r.score.Red} a ${r.score.Blue} ${r.blue.name}, ${r.map}`}>
                    {r.score.Red} <span className="text-muted">–</span> {r.score.Blue}
                  </Link>
                </Td>
                <Td className={r.winner === "Blue" ? "font-semibold text-ink" : "text-ink-2"}>{r.blue.name}</Td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-2">Nenhuma partida com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

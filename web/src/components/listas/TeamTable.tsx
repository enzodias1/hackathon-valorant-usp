"use client";
// Lista de times com busca por nome e filtro por competição. Cada linha leva para /times/<slug>.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pct } from "@/lib/format";
import type { TeamSummary } from "@/lib/types";
import { Badge, Td, Th } from "@/components/analise/ui";
import { ResultCount, SearchFilter, SelectFilter, fold, useUrlFilters } from "./controls";

const KEYS = ["busca", "competicao"] as const;

export default function TeamTable({ teams }: { teams: TeamSummary[] }) {
  const router = useRouter();
  const { filters, set, clear } = useUrlFilters(KEYS);
  const competitions = [...new Set(teams.flatMap((t) => t.competitions))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const q = fold(filters.busca.trim());
  const shown = teams.filter((t) =>
    (!q || fold(t.name).includes(q) || fold(t.tag).includes(q)) &&
    (!filters.competicao || t.competitions.includes(filters.competicao)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SearchFilter label="Buscar time" value={filters.busca} onChange={(v) => set("busca", v)} placeholder="ex.: UFMT" />
        <SelectFilter label="Competição" value={filters.competicao} onChange={(v) => set("competicao", v)}
                      options={competitions.map((c) => ({ value: c, label: c }))} all="Todas" />
      </div>
      <ResultCount shown={shown.length} total={teams.length} noun="times" onClear={clear} />

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <Th>Time</Th>
              <Th right>Mapas</Th>
              <Th right>V · D</Th>
              <Th right>Mapas vencidos</Th>
              <Th right>Rounds vencidos</Th>
              <Th>Competições</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.slug} onClick={() => router.push(`/times/${t.slug}`)} className="cursor-pointer hover:bg-surface-2">
                <Td>
                  <Link href={`/times/${t.slug}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:underline hover:underline-offset-4">
                    {t.name}
                  </Link>
                </Td>
                <Td right>{t.maps}</Td>
                <Td right className="whitespace-nowrap text-ink-2">{t.map_wins} · {t.maps - t.map_wins}</Td>
                <Td right>{pct(t.maps ? t.map_wins / t.maps : null)}</Td>
                <Td right>{pct(t.round_win)} <span className="text-muted">· {t.rounds}</span></Td>
                <Td>
                  <div className="flex flex-wrap gap-1">{t.competitions.map((c) => <Badge key={c}>{c}</Badge>)}</div>
                </Td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-2">Nenhum time encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

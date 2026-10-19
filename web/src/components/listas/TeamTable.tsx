"use client";
// Lista de times com busca por nome, filtro por competição e ordenação (força ou mapas). Cada linha leva para /times/<slug>.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pct } from "@/lib/format";
import type { TeamSummary } from "@/lib/types";
import { Badge, Td, Th } from "@/components/analise/ui";
import { ResultCount, SearchFilter, SelectFilter, fold, useUrlFilters } from "./controls";

const KEYS = ["busca", "competicao", "ordem"] as const;
const MIN_ROUNDS_RELIABLE = 100; // abaixo disso a força é uma estimativa imprecisa (puxada para a média)

export default function TeamTable({ teams }: { teams: TeamSummary[] }) {
  const router = useRouter();
  const { filters, set, clear } = useUrlFilters(KEYS);
  const competitions = [...new Set(teams.flatMap((t) => t.competitions))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const order = filters.ordem || "forca";

  const q = fold(filters.busca.trim());
  const shown = teams
    .filter((t) => (!q || fold(t.name).includes(q) || fold(t.tag).includes(q)) && (!filters.competicao || t.competitions.includes(filters.competicao)))
    .sort((a, b) => (order === "mapas" ? b.maps - a.maps || a.strength_rank - b.strength_rank : a.strength_rank - b.strength_rank));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SearchFilter label="Buscar time" value={filters.busca} onChange={(v) => set("busca", v)} placeholder="ex.: UFMT" />
        <SelectFilter label="Competição" value={filters.competicao} onChange={(v) => set("competicao", v)}
                      options={competitions.map((c) => ({ value: c, label: c }))} all="Todas" />
        <SelectFilter label="Ordenar por" value={filters.ordem} onChange={(v) => set("ordem", v)}
                      options={[{ value: "mapas", label: "Mapas jogados" }]} all="Força (ranking)" />
      </div>
      <ResultCount shown={shown.length} total={teams.length} noun="times" onClear={clear} />

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full sm:min-w-[760px]">
          <thead>
            <tr>
              <Th right>Força</Th>
              <Th>Time</Th>
              <Th right className="hidden sm:table-cell">Mapas</Th>
              <Th right>V · D</Th>
              <Th right>Rounds vencidos</Th>
              <Th className="hidden sm:table-cell">Competições</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => {
              const reliable = t.rounds >= MIN_ROUNDS_RELIABLE;
              return (
                <tr key={t.slug} onClick={() => router.push(`/times/${t.slug}`)} className="cursor-pointer hover:bg-surface-2">
                  <Td right className="whitespace-nowrap">
                    <span className={reliable ? "font-semibold text-ink" : "text-muted"}
                          title={reliable ? `Vence ${pct(t.strength)} dos rounds contra um time médio` : "Menos de 100 rounds: estimativa imprecisa"}>
                      {t.strength_rank}º
                    </span>
                    <span className="ml-1.5 hidden text-xs text-muted sm:inline">{pct(t.strength)}</span>
                  </Td>
                  <Td>
                    <Link href={`/times/${t.slug}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:underline hover:underline-offset-4">
                      {t.name}
                    </Link>
                  </Td>
                  <Td right className="hidden sm:table-cell">{t.maps}</Td>
                  <Td right className="whitespace-nowrap text-ink-2">{t.map_wins} · {t.maps - t.map_wins}</Td>
                  <Td right className="whitespace-nowrap">{pct(t.round_win)} <span className="text-muted">· {t.rounds}</span></Td>
                  <Td className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">{t.competitions.map((c) => <Badge key={c}>{c}</Badge>)}</div>
                  </Td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-2">Nenhum time encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Força: ranking pela chance de vencer um round contra um time médio, descontando a economia (modelo de Bradley-Terry). O percentual ao lado é essa
        chance. Em cinza, times com menos de {MIN_ROUNDS_RELIABLE} rounds, cuja posição ainda é imprecisa. <Link href="/como-funciona#comparacoes" className="text-accent hover:underline">Como funciona</Link>
      </p>
    </div>
  );
}

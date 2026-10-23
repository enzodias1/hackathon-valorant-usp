"use client";
// Lista de times com busca por nome e ordenação (força ou mapas), em abas: o ranking geral (todos os campeonatos) ou o de um
// campeonato, só com as partidas dele (força recalculada só com elas). Cada linha leva para /times/<slug>.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pct } from "@/lib/format";
import type { TeamSummary } from "@/lib/types";
import { Badge, Td, Th } from "@/components/analise/ui";
import { ResultCount, SearchFilter, SelectFilter, fold, useUrlFilters } from "./controls";

const KEYS = ["busca", "campeonato", "ordem"] as const;
const MIN_ROUNDS_RELIABLE = 100; // abaixo disso a força é uma estimativa imprecisa (puxada para a média)
const MIN_MAPS_COMP = 2;         // num campeonato só, a régua é 2 mapas: os campeonatos menores têm poucos rounds por time

export default function TeamTable({ teams }: { teams: TeamSummary[] }) {
  const router = useRouter();
  const { filters, set, clear } = useUrlFilters(KEYS);
  const competitions = [...new Set(teams.flatMap((t) => t.competitions))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const order = filters.ordem || "forca";
  const comp = competitions.includes(filters.campeonato) ? filters.campeonato : "";

  // a linha de cada time na aba: geral (todos os campeonatos) ou só as partidas do campeonato escolhido
  const rows = teams.flatMap((t) => {
    const c = comp ? t.by_competition[comp] : null;
    if (comp && !c) return [];
    return [{ t, maps: c ? c.maps : t.maps, wins: c ? c.map_wins : t.map_wins, rounds: c ? c.rounds : t.rounds,
              roundWin: c ? c.round_win : t.round_win, rank: (c ? c.strength_rank : t.strength_rank) ?? 999, strength: c ? c.strength : t.strength,
              reliable: c ? c.maps >= MIN_MAPS_COMP : t.rounds >= MIN_ROUNDS_RELIABLE }];
  });
  const q = fold(filters.busca.trim());
  const shown = rows
    .filter(({ t }) => !q || fold(t.name).includes(q) || fold(t.tag).includes(q))
    .sort((a, b) => (order === "mapas" ? b.maps - a.maps || a.rank - b.rank : a.rank - b.rank));

  return (
    <div className="space-y-4">
      {/* abas: ranking geral ou de um campeonato */}
      <div role="tablist" aria-label="Campeonato" className="flex flex-wrap gap-2">
        {["", ...competitions].map((c) => (
          <button key={c || "geral"} type="button" role="tab" aria-selected={comp === c} onClick={() => set("campeonato", c)}
                  className={`label-caps rounded-lg border px-4 py-2.5 text-[11px] transition-colors ${comp === c
                    ? "border-lime bg-lime text-bg" : "border-line bg-surface text-ink-2 hover:border-ink-2 hover:text-ink"}`}>
            {c || "Geral"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SearchFilter label="Buscar time" value={filters.busca} onChange={(v) => set("busca", v)} placeholder="ex.: UFMT" />
        <SelectFilter label="Ordenar por" value={filters.ordem} onChange={(v) => set("ordem", v)}
                      options={[{ value: "mapas", label: "Mapas jogados" }]} all="Força (ranking)" />
      </div>
      <ResultCount shown={shown.length} total={rows.length} noun="times" onClear={clear} />

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
            {shown.map(({ t, maps, wins, rounds, roundWin, rank, strength, reliable }) => {
              return (
                <tr key={t.slug} onClick={() => router.push(`/times/${t.slug}`)} className="cursor-pointer hover:bg-surface-2">
                  <Td right className="whitespace-nowrap">
                    <span className={reliable ? "font-semibold text-ink" : "text-muted"}
                          title={reliable ? `Vence ${pct(strength)} dos rounds contra um time médio${comp ? ` da ${comp}` : ""}`
                            : comp ? `Menos de ${MIN_MAPS_COMP} mapas neste campeonato: estimativa imprecisa` : "Menos de 100 rounds: estimativa imprecisa"}>
                      {rank === 999 ? "—" : `${rank}º`}
                    </span>
                    <span className="ml-1.5 hidden text-xs text-muted sm:inline">{pct(strength)}</span>
                  </Td>
                  <Td>
                    <Link href={`/times/${t.slug}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:underline hover:underline-offset-4">
                      {t.name}
                    </Link>
                  </Td>
                  <Td right className="hidden sm:table-cell">{maps}</Td>
                  <Td right className="whitespace-nowrap text-ink-2">{wins} · {maps - wins}</Td>
                  <Td right className="whitespace-nowrap">{pct(roundWin)} <span className="text-muted">· {rounds}</span></Td>
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
        chance. {comp
          ? <>Nesta aba, tudo vem só das partidas da {comp}: a força é recalculada só com elas, contra a média dos times desse campeonato. Em cinza, times com menos de {MIN_MAPS_COMP} mapas nele.</>
          : <>Em cinza, times com menos de {MIN_ROUNDS_RELIABLE} rounds, cuja posição ainda é imprecisa.</>} <Link href="/metodologia#comparacoes" className="text-accent hover:underline">Metodologia</Link>
      </p>
    </div>
  );
}

"use client";
// Lista de jogadores com busca por nick e filtros por time e papel. Cada linha leva para /jogadores/<puuid>.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nick, num } from "@/lib/format";
import type { BehaviorRole, PlayerSummary } from "@/lib/types";
import { Td, Th, WpaBar } from "@/components/analise/ui";
import { ResultCount, SearchFilter, SelectFilter, fold, useUrlFilters } from "./controls";

export type PlayerRow = PlayerSummary & { team_name: string };

const KEYS = ["busca", "time", "papel"] as const;
const ROLES: BehaviorRole[] = ["Entry", "Support", "Lurker", "Clutch"];

export default function PlayerTable({ players }: { players: PlayerRow[] }) {
  const router = useRouter();
  const { filters, set, clear } = useUrlFilters(KEYS);
  const teams = [...new Map(players.map((p) => [p.team, p.team_name]))]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  // a escala da barra ignora amostras pequenas, que têm valores extremos
  const maxWpa = Math.max(...players.filter((p) => p.eligible).map((p) => Math.abs(p.wpa_per_round)), 0.1);

  const q = fold(filters.busca.trim());
  const shown = players.filter((p) =>
    (!q || fold(p.name).includes(q)) &&
    (!filters.time || p.team === filters.time) &&
    (!filters.papel || p.behavior_role === filters.papel));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SearchFilter label="Buscar por nick" value={filters.busca} onChange={(v) => set("busca", v)} placeholder="ex.: J3YP" />
        <SelectFilter label="Time" value={filters.time} onChange={(v) => set("time", v)} options={teams} />
        <SelectFilter label="Papel (pelo comportamento)" value={filters.papel} onChange={(v) => set("papel", v)}
                      options={ROLES.map((r) => ({ value: r, label: r }))} />
      </div>
      <ResultCount shown={shown.length} total={players.length} noun="jogadores" onClear={clear} />

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full sm:min-w-[760px]">
          <thead>
            <tr>
              <Th>Jogador</Th>
              <Th className="hidden sm:table-cell">Time</Th>
              <Th className="hidden sm:table-cell">Função (agentes)</Th>
              <Th className="hidden sm:table-cell">Papel real</Th>
              <Th right className="hidden sm:table-cell">Rounds</Th>
              <Th right>K/D</Th>
              <Th>Impacto por round</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.puuid} onClick={() => router.push(`/jogadores/${p.puuid}`)} className="cursor-pointer hover:bg-surface-2">
                <Td>
                  <Link href={`/jogadores/${p.puuid}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:underline hover:underline-offset-4">
                    {nick(p.name)}
                  </Link>
                  <div className="text-xs text-muted sm:hidden">{p.team_name}{p.behavior_role && ` · ${p.behavior_role}`}</div>
                </Td>
                <Td className="hidden sm:table-cell text-ink-2">{p.team_name}</Td>
                <Td className="hidden sm:table-cell text-ink-2">{p.agent_role ?? "—"}</Td>
                <Td className="hidden sm:table-cell text-ink-2">{p.behavior_role ?? "—"}</Td>
                <Td right className="hidden sm:table-cell">{p.rounds}</Td>
                <Td right>{num(p.kd, 2)}</Td>
                <Td>
                  {p.eligible ? <WpaBar value={p.wpa_per_round} max={maxWpa} /> : (
                    <span className="text-xs text-muted" title="Menos de 60 rounds: o impacto ainda não é confiável">amostra pequena</span>
                  )}
                </Td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-2">Nenhum jogador encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

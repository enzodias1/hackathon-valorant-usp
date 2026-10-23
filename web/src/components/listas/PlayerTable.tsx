"use client";
// Lista de jogadores com busca por nick e filtros por time e função do agente, em abas: o ranking geral (todos os campeonatos)
// ou o de um campeonato (no Univavá, também de uma fase), só com quem jogou e só com as partidas dele. Cada linha leva para
// /jogadores/<puuid>, que soma todos os campeonatos.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nick, num } from "@/lib/format";
import type { AgentRole, PlayerSummary } from "@/lib/types";
import { Td, Th, WpaBar } from "@/components/analise/ui";
import { CompetitionTabs, ResultCount, SearchFilter, SelectFilter, UNIVAVA, fold, scopeOf, stageSort, useUrlFilters } from "./controls";

const KEYS = ["busca", "campeonato", "fase", "time", "funcao"] as const;
const ROLES: AgentRole[] = ["Duelista", "Iniciador", "Controlador", "Sentinela"];
const MIN_ROUNDS = 60; // geral e Univavá inteiro: a mesma régua da página do jogador
const MIN_MAPS = 2;    // numa Rush Series ou numa fase do Univavá, com poucos mapas por time: a régua das brabas e dos times

export default function PlayerTable({ players, teamNames }: { players: PlayerSummary[]; teamNames: Record<string, string> }) {
  const router = useRouter();
  const { filters, set, setMany, clear } = useUrlFilters(KEYS);
  const competitions = [...new Set(players.flatMap((p) => Object.keys(p.by_competition ?? {})))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const comp = competitions.includes(filters.campeonato) ? filters.campeonato : "";
  const stages = [...new Set(players.flatMap((p) => Object.keys(p.by_stage ?? {})))].sort(stageSort);
  const stage = comp === UNIVAVA && stages.includes(filters.fase) ? filters.fase : "";
  const scope = scopeOf(comp, stage);
  const byMaps = !!stage || (!!comp && comp !== UNIVAVA);
  const teamName = (slug: string) => teamNames[slug] ?? slug;

  // a linha de cada jogador na aba: geral, só as partidas do campeonato ou só as de uma fase do Univavá (e só quem jogou ali);
  // primeiro quem tem amostra suficiente, por impacto (a posição no ranking da aba), depois o resto, por rounds jogados
  const rows = players
    .flatMap((p) => {
      const s = stage ? p.by_stage?.[stage] : comp ? p.by_competition?.[comp] : null;
      if (comp && !s) return [];
      return [{ p, team: s ? s.team : p.team, others: s ? s.other_teams ?? [] : (p.other_teams ?? []).map((o) => o.slug),
                role: s ? s.agent_role : p.agent_role, rounds: s ? s.rounds : p.rounds, kd: s ? s.kd : p.kd,
                wpa: s ? s.wpa_per_round : p.wpa_per_round,
                eligible: s ? (byMaps ? s.maps >= MIN_MAPS : s.rounds >= MIN_ROUNDS) : p.eligible }];
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || (a.eligible ? b.wpa - a.wpa : b.rounds - a.rounds))
    .map((r, i) => ({ ...r, pos: r.eligible ? i + 1 : null }));

  // times da aba; um time escolhido em outra aba que não jogou aqui não filtra
  const teams = [...new Set(rows.flatMap((r) => [r.team, ...r.others]))]
    .map((value) => ({ value, label: teamName(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const team = teams.some((o) => o.value === filters.time) ? filters.time : "";
  // a escala da barra ignora amostras pequenas, que têm valores extremos
  const maxWpa = Math.max(...rows.filter((r) => r.eligible).map((r) => Math.abs(r.wpa)), 0.1);

  const q = fold(filters.busca.trim());
  const shown = rows.filter((r) =>
    (!q || fold(r.p.name).includes(q)) &&
    (!team || r.team === team || r.others.includes(team)) &&
    (!filters.funcao || r.role === filters.funcao));

  const minLabel = byMaps ? `${MIN_MAPS} mapas` : `${MIN_ROUNDS} rounds`;
  const smallTitle = `Menos de ${minLabel}${stage ? " nesta fase" : comp ? " neste campeonato" : ""}: o impacto ainda não é confiável`;

  return (
    <div className="space-y-4">
      <CompetitionTabs competitions={competitions} value={comp} onChange={(c) => setMany({ campeonato: c, fase: "" })} />
      <div className={`grid gap-3 ${comp === UNIVAVA ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <SearchFilter label="Buscar por nick" value={filters.busca} onChange={(v) => set("busca", v)} placeholder="ex.: J3YP" />
        {comp === UNIVAVA && (
          <SelectFilter label="Fase" value={stage} onChange={(v) => set("fase", v)}
                        options={stages.map((s) => ({ value: s, label: s }))} all="Geral (todas as fases)" />
        )}
        <SelectFilter label="Time" value={team} onChange={(v) => set("time", v)} options={teams} />
        <SelectFilter label="Função do agente" value={filters.funcao} onChange={(v) => set("funcao", v)}
                      options={ROLES.map((r) => ({ value: r, label: r }))} />
      </div>
      <ResultCount shown={shown.length} total={rows.length} noun="jogadores" onClear={clear} />

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full sm:min-w-[760px]">
          <thead>
            <tr>
              <Th right>#</Th>
              <Th>Jogador</Th>
              <Th className="hidden sm:table-cell">Time</Th>
              <Th className="hidden sm:table-cell">Função (agentes)</Th>
              <Th right className="hidden sm:table-cell">Rounds</Th>
              <Th right>K/D</Th>
              <Th>Impacto por round</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ p, team: t, others, role, rounds, kd, wpa, eligible, pos }) => (
              <tr key={p.puuid} onClick={() => router.push(`/jogadores/${p.puuid}`)} className="cursor-pointer hover:bg-surface-2">
                <Td right className="tabular text-ink-2">{pos ?? "—"}</Td>
                <Td>
                  <Link href={`/jogadores/${p.puuid}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:underline hover:underline-offset-4">
                    {nick(p.name)}
                  </Link>
                  <div className="text-xs text-muted sm:hidden">{teamName(t)}{others.length > 0 && ` +${others.length}`}{role && ` · ${role}`}</div>
                </Td>
                <Td className="hidden sm:table-cell text-ink-2">
                  {teamName(t)}
                  {others.length > 0 && <span className="block text-xs text-muted">e {others.map(teamName).join(", ")}</span>}
                </Td>
                <Td className="hidden sm:table-cell text-ink-2">{role ?? "—"}</Td>
                <Td right className="hidden sm:table-cell">{rounds}</Td>
                <Td right>{num(kd, 2)}</Td>
                <Td>
                  {eligible ? <WpaBar value={wpa} max={maxWpa} /> : (
                    <span className="text-xs text-muted" title={smallTitle}>amostra pequena</span>
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
      <p className="text-xs text-muted">
        {comp
          ? <>Aqui, só quem jogou {stage ? "essa fase" : "esse campeonato"} e só as partidas d{scope}: impacto, K/D, rounds, time e função contam só elas, e a
            posição (#) é entre esses jogadores, a partir de {minLabel} {stage ? "nela" : "nele"}. A página de cada jogador soma todos os campeonatos.</>
          : <>Posição (#) pelo impacto por round, entre os jogadores com {MIN_ROUNDS} rounds ou mais somando todos os campeonatos.</>}
      </p>
    </div>
  );
}

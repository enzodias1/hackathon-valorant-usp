import Link from "next/link";
import type { Metadata } from "next";
import { getIndex, getPlayer } from "@/lib/data";
import { clock, nick, num, pct, pp } from "@/lib/format";
import type { Moment, Player } from "@/lib/types";
import { MatchImpactChart, RoleRadar } from "@/components/analise/PlayerCharts";
import { Badge, CompareRow, InsightPanel, PercentileRow, PlayerLink, Section, StatTile, TeamLink, Td, Th, WpaBar } from "@/components/analise/ui";

export async function generateStaticParams() {
  return (await getIndex()).players.map((p) => ({ puuid: p.puuid }));
}

export async function generateMetadata({ params }: { params: Promise<{ puuid: string }> }): Promise<Metadata> {
  const p = await getPlayer((await params).puuid);
  return { title: `${nick(p.name)} · Analista UNIVAVÁ` };
}

const BREAKDOWN_LABEL: Record<string, string> = { kill: "Kills", assist: "Assistências", plant: "Plants", defuse: "Desarmes", death: "Mortes" };

export default async function PlayerPage({ params }: { params: Promise<{ puuid: string }> }) {
  const p: Player = await getPlayer((await params).puuid);
  const s = p.summary, imp = p.impact, pc = p.percentiles;
  // por round, para ficar na mesma escala do "impacto por round"
  const breakdown = Object.entries(imp.breakdown).filter(([, v]) => v !== 0).map(([k, v]) => [k, v / p.sample.rounds] as const).sort((a, b) => b[1] - a[1]);
  const maxB = Math.max(...breakdown.map(([, v]) => Math.abs(v)));
  const maxAgent = Math.max(...p.agents.map((a) => Math.abs(a.wpa_per_round)), 0.1);
  const maxMap = Math.max(...p.maps.map((a) => Math.abs(a.wpa_per_round)), 0.1);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <Link href="/jogadores" className="text-sm text-muted hover:text-ink-2">← Jogadores</Link>
        <h1 className="text-3xl font-bold text-ink">{nick(p.name)} <span className="text-lg font-normal text-muted">#{p.name.split("#")[1]}</span></h1>
        <div className="flex flex-wrap items-center gap-2 text-ink-2">
          <TeamLink slug={p.team} name={p.team_name} />
          {p.teams.length > 1 && <span className="text-sm text-muted">(também jogou por {p.teams.slice(1).map((t) => t.name).join(", ")})</span>}
          {p.role.agent_role && <Badge title="Função dos agentes que mais joga">{p.role.agent_role}</Badge>}
          {p.role.behavior_role && <Badge title="Papel descoberto pelo comportamento em jogo">Em jogo: {p.role.behavior_role}</Badge>}
        </div>
        {!p.sample.eligible && (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
            <span className="font-bold text-warn">!</span> Amostra pequena ({p.sample.rounds} rounds): percentis e papel em jogo aparecem a partir de 60 rounds.
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Impacto por round" value={pp(imp.wpa_per_round)} tone={imp.wpa_per_round >= 0 ? "good" : "bad"}
                  sub={pc?.wpa_per_round != null ? `percentil ${Math.round(pc.wpa_per_round)} da liga` : `${p.sample.rounds} rounds`} />
        <StatTile label="K/D" value={num(s.kd, 2)} sub={pc?.kd != null ? `percentil ${Math.round(pc.kd)}` : `${s.kills}/${s.deaths}`} />
        <StatTile label="ACS" value={num(s.acs)} sub={pc?.acs != null ? `percentil ${Math.round(pc.acs)}` : undefined} />
        <StatTile label="KAST" value={pct(s.kast)} sub={pc?.kast != null ? `percentil ${Math.round(pc.kast)}` : undefined} />
        <StatTile label="Rounds" value={p.sample.rounds} sub={`${p.sample.maps} mapas`} />
      </div>

      <Section title="Diagnóstico" subtitle="Comparação com a média da liga. Pontos fortes e fracos só aparecem quando a diferença é estatisticamente confiável.">
        <InsightPanel insights={p.insights} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Perfil de jogo" subtitle="Percentis na liga (0–100) em cada eixo de comportamento. O maior eixo de papel define o papel em jogo.">
          {p.role.axes ? <RoleRadar axes={p.role.axes} /> : <p className="text-sm text-ink-2">Disponível a partir de 60 rounds.</p>}
        </Section>
        <Section title="Impacto vs. estatísticas tradicionais" subtitle="Percentil na liga: 100 = melhor da liga. Compare o impacto com o K/D.">
          {pc ? (
            <div>
              <PercentileRow label="Impacto / round" value={pc.wpa_per_round} />
              <PercentileRow label="K/D" value={pc.kd} />
              <PercentileRow label="Kills / round" value={pc.kpr} />
              <PercentileRow label="ADR" value={pc.adr} />
              <PercentileRow label="KAST" value={pc.kast} />
              <PercentileRow label="% headshot" value={pc.hs_pct} />
              <PercentileRow label="Abre rounds" value={pc.opening_rate} hint="frequência com que disputa o primeiro duelo" />
              <PercentileRow label="Clutches" value={pc.clutch_rate} hint="frequência de situações em que fica sozinho" />
            </div>
          ) : <p className="text-sm text-ink-2">Disponível a partir de 60 rounds.</p>}
        </Section>
      </div>

      <Section title="De onde vem o impacto" subtitle="Variação média na chance de vitória por round, por tipo de ação (pontos percentuais). Mortes sempre custam; a pergunta é quanto.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            {breakdown.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm text-ink-2">{BREAKDOWN_LABEL[k] ?? k}</span>
                <WpaBar value={v} max={maxB} />
              </div>
            ))}
            <p className="pt-1 text-sm text-ink">Saldo: <b>{pp(imp.wpa_per_round)}</b> por round <span className="text-muted">({pp(imp.wpa_total, 0)} em {p.sample.rounds} rounds)</span></p>
          </div>
          <div className="divide-y divide-line/50">
            {p.comparisons.kill_value && <CompareRow label="Valor médio de cada kill" c={p.comparisons.kill_value} format={(x) => pp(x)} domain={[0, 30]} />}
            {p.comparisons.death_cost && <CompareRow label="Custo médio de cada morte" c={p.comparisons.death_cost} format={(x) => pp(x)} domain={[-30, 0]} />}
            {p.comparisons.traded_death_rate && <CompareRow label="Mortes trocadas pelo time" c={p.comparisons.traded_death_rate} domain={[0, 0.6]} />}
            {p.comparisons.isolated_death_rate && <CompareRow label="Mortes isoladas" c={p.comparisons.isolated_death_rate} domain={[0, 0.6]} />}
            {p.comparisons.first_duel && <CompareRow label="Primeiros duelos vencidos" c={p.comparisons.first_duel} />}
            {p.comparisons.clutch_win && <CompareRow label="Clutches vencidos" c={p.comparisons.clutch_win} />}
          </div>
        </div>
      </Section>

      <Section title="Impacto partida a partida" subtitle={`Cada barra é uma partida, em ordem cronológica. Ataque: ${pp(imp.wpa_pr_atk)} por round · Defesa: ${pp(imp.wpa_pr_def)} por round.`}>
        <MatchImpactChart matches={p.matches} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Jogadas que mais mudaram rounds" subtitle="Chance de vitória do time antes → depois da jogada.">
          <MomentList items={p.best_plays} kind="play" />
        </Section>
        <Section title="Mortes que mais custaram" subtitle="Chance de vitória do time antes → depois da morte. Bons rounds para revisar.">
          <MomentList items={p.costliest_deaths} kind="death" />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Agentes">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Agente</Th><Th right>Mapas</Th><Th right>K/D</Th><Th right>ACS</Th><Th>Impacto / round</Th></tr></thead>
              <tbody>
                {p.agents.map((a) => (
                  <tr key={a.agent}>
                    <Td><span className="flex items-center gap-2">{a.icon && <img src={a.icon} alt="" className="h-6 w-6 rounded" />}{a.agent}</span></Td>
                    <Td right>{a.maps}</Td><Td right>{num(a.kd, 2)}</Td><Td right>{num(a.acs)}</Td>
                    <Td><WpaBar value={a.wpa_per_round} max={maxAgent} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Mapas">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Mapa</Th><Th right>Mapas</Th><Th right>Vitórias</Th><Th right>K/D</Th><Th>Impacto / round</Th></tr></thead>
              <tbody>
                {p.maps.map((m) => (
                  <tr key={m.map}>
                    <Td>{m.map}</Td><Td right>{m.maps}</Td><Td right>{pct(m.map_win_rate)}</Td><Td right>{num(m.kd, 2)}</Td>
                    <Td><WpaBar value={m.wpa_per_round} max={maxMap} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title="Parceiros" subtitle="Quem cobre você (vinga suas mortes em até 5 s) e quem você cobre.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead><tr><Th>Parceiro</Th><Th right>Rounds juntos</Th><Th right>Vingou você</Th><Th right>Você vingou</Th><Th right>Assistências nas suas kills</Th></tr></thead>
            <tbody>
              {p.partners.map((x) => (
                <tr key={x.puuid}>
                  <Td><PlayerLink puuid={x.puuid} name={nick(x.name)} /></Td>
                  <Td right>{x.rounds_together}</Td>
                  <Td right>{x.they_traded_you}× <span className="text-muted">({pct(x.your_deaths_with_them_alive ? x.they_traded_you / x.your_deaths_with_them_alive : null)})</span></Td>
                  <Td right>{x.you_traded_them}×</Td>
                  <Td right>{x.their_assists_on_your_kills}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}

function MomentList({ items, kind }: { items: Moment[]; kind: "play" | "death" }) {
  if (!items.length) return <p className="text-sm text-ink-2">Sem registros.</p>;
  const verb = (m: Moment) => m.event === "plant" ? "Plantou a spike" : m.event === "defuse" ? "Desarmou a spike" : kind === "play" ? `Matou ${nick(m.other)}${m.weapon ? ` (${m.weapon})` : ""}` : `Morreu para ${nick(m.other)}`;
  return (
    <ul className="divide-y divide-line/50">
      {items.map((m) => (
        <li key={`${m.match_id}-${m.round}-${m.t}`}>
          <Link href={`/partidas/${m.match_id}#round-${m.round}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-surface-2">
            <span>
              <span className="text-ink">{verb(m)}</span>
              <span className="block text-xs text-muted">{m.map} · round {m.round} · {clock(m.t)}</span>
            </span>
            <span className="tabular shrink-0 text-right">
              <span className="text-ink-2">{pct(m.wp_before)} → {pct(m.wp_after)}</span>
              <span className={`block text-xs ${m.wpa >= 0 ? "text-good" : "text-bad"}`}>{pp(m.wpa)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

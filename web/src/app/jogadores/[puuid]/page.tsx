import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { getIndex, getPlayer } from "@/lib/data";
import { clock, nick, num, pct, pp } from "@/lib/format";
import type { Moment, Player } from "@/lib/types";
import { MatchImpactChart, RoleRadar } from "@/components/analise/PlayerCharts";
import { BandButton, CompareRow, InsightPanel, PageBand, PercentileRow, PlayerLink, Section, StatTile, Td, Th, WpaBar } from "@/components/analise/ui";
import { agentArt } from "@/lib/art";
import { DeathTimingPanel, DuelsPanel, referenceLabel } from "@/components/analise/PlayerDuels";
import { AbilitiesPanel } from "@/components/analise/PlayerAbilities";

// só as páginas geradas no build existem; outro id vira 404 (site 100% estático)
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getIndex()).players.map((p) => ({ puuid: p.puuid }));
}

export async function generateMetadata({ params }: { params: Promise<{ puuid: string }> }): Promise<Metadata> {
  const p = await getPlayer((await params).puuid);
  const stats = p.sample.eligible ? `impacto ${pp(p.impact.wpa_per_round)} por round · K/D ${num(p.summary.kd, 2)}` : `K/D ${num(p.summary.kd, 2)} em ${p.sample.rounds} rounds`;
  return pageMeta(`${nick(p.name)} · Analista UNIVAVÁ`,
    `${p.team_name} · ${stats}. Impacto real de cada jogada, o papel que joga de fato e os parceiros que cobrem suas mortes.`);
}

const BREAKDOWN_LABEL: Record<string, string> = { kill: "Kills", assist: "Assistências", plant: "Plants", defuse: "Desarmes", revive: "Ressurreições", death: "Mortes" };

export default async function PlayerPage({ params }: { params: Promise<{ puuid: string }> }) {
  const p: Player = await getPlayer((await params).puuid);
  const s = p.summary, imp = p.impact, pc = p.percentiles;
  // por round, para ficar na mesma escala do "impacto por round"
  const breakdown = Object.entries(imp.breakdown).filter(([, v]) => v !== 0).map(([k, v]) => [k, v / p.sample.rounds] as const).sort((a, b) => b[1] - a[1]);
  const maxB = Math.max(...breakdown.map(([, v]) => Math.abs(v)));
  const maxAgent = Math.max(...p.agents.map((a) => Math.abs(a.wpa_per_round)), 0.1);
  const maxMap = Math.max(...p.maps.map((a) => Math.abs(a.wpa_per_round)), 0.1);
  const mainAgent = p.agents[0]?.agent;
  const bestAgent = [...p.agents].filter((a) => a.rounds >= 40).sort((a, b) => b.wpa_per_round - a.wpa_per_round)[0];
  const bestMap = [...p.maps].filter((m) => m.rounds >= 40).sort((a, b) => b.wpa_per_round - a.wpa_per_round)[0];
  const topPartner = p.partners[0];
  const best = p.best_plays[0];
  const posMatches = p.matches.filter((m) => m.wpa > 0).length;

  const du = p.duels;
  const mostKilled = [...du.opponents].sort((a, b) => b.kills - a.kills)[0];
  const mostKilledBy = [...du.opponents].sort((a, b) => b.deaths - a.deaths)[0];
  const duelsTeaser = du.win_rate == null ? "Sem duelos registrados"
    : [`Vence ${pct(du.win_rate)} dos duelos`,
       mostKilled?.kills ? `mais elimina ${nick(mostKilled.name)} (${mostKilled.kills}×)` : null,
       mostKilledBy?.deaths ? `mais é eliminado por ${nick(mostKilledBy.name)} (${mostKilledBy.deaths}×)` : null].filter(Boolean).join(" · ");

  return (
    <main>
      <PageBand back={{ href: "/jogadores", label: "Jogadores" }} art={agentArt(mainAgent)}
                kicker={[p.role.agent_role, p.role.behavior_role && `em jogo: ${p.role.behavior_role}`].filter(Boolean).join(" · ")}
                title={<>{nick(p.name)} <span className="text-[0.45em] text-white/60">#{p.name.split("#")[1]}</span></>}
                actions={<BandButton href={`/times/${p.team}`} primary>Ver {p.team_name}</BandButton>}>
        <p className="text-sm">
          {mainAgent && <>Mais jogado: <b>{mainAgent}</b> · </>}{p.sample.rounds} rounds em {p.sample.maps} mapas
          {p.teams.length > 1 && <span className="text-white/60"> · também jogou por {p.teams.slice(1).map((t) => t.name).join(", ")}</span>}
        </p>
      </PageBand>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-8">
        {!p.sample.eligible && (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
            <span className="font-bold text-warn">!</span> Amostra pequena ({p.sample.rounds} rounds): percentis e papel em jogo aparecem a partir de 60 rounds.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Impacto por round" value={pp(imp.wpa_per_round)} tone={imp.wpa_per_round >= 0 ? "good" : "bad"}
                    sub={pc?.wpa_per_round != null ? `percentil ${Math.round(pc.wpa_per_round)} da liga` : `${p.sample.rounds} rounds`} />
          <StatTile label="K/D" value={num(s.kd, 2)} sub={pc?.kd != null ? `percentil ${Math.round(pc.kd)}` : `${s.kills}/${s.deaths}`} />
          <StatTile label="ACS" value={num(s.acs)} sub={pc?.acs != null ? `percentil ${Math.round(pc.acs)}` : undefined} />
          <StatTile label="KAST" value={pct(s.kast)} sub={pc?.kast != null ? `percentil ${Math.round(pc.kast)}` : undefined} />
          <StatTile label="Rounds" value={p.sample.rounds} sub={`${p.sample.maps} mapas`} />
        </div>

        <Section id="diagnostico" title="Diagnóstico" collapsible defaultOpen
                 info="Comparação com a média da liga. Pontos fortes e fracos só aparecem quando a diferença é estatisticamente confiável, já com controle de falsos positivos.">
          <InsightPanel insights={p.insights} />
        </Section>

        <Section id="perfil" title="Perfil de jogo" collapsible teaser={p.role.behavior_role ? `Papel em jogo: ${p.role.behavior_role}${p.role.agent_role ? ` (joga de ${p.role.agent_role})` : ""}` : "Disponível a partir de 60 rounds"}
                 info="À esquerda, o percentil na liga (0–100) em cada eixo de comportamento: o maior eixo de papel define o papel em jogo. À direita, o impacto comparado às estatísticas tradicionais (100 = melhor da liga).">
          <div className="grid gap-6 lg:grid-cols-2">
            {p.role.axes ? <RoleRadar axes={p.role.axes} /> : <p className="text-sm text-ink-2">Disponível a partir de 60 rounds.</p>}
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
            ) : null}
          </div>
        </Section>

        <Section id="impacto" title="De onde vem o impacto" collapsible teaser={`Saldo: ${pp(imp.wpa_per_round)} por round · cada kill vale ${pp(imp.per_kill)} (liga ${pp(imp.league_per_kill)})`}
                 info="Variação média na chance de vitória por round, por tipo de ação, em pontos de chance (se a chance vai de 45% para 76%, a jogada vale +31 pontos). Mortes sempre custam; a pergunta é quanto. À direita, cada métrica comparada com a liga.">
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

        <Section id="duelos" title="Duelos" collapsible teaser={duelsTeaser}
                 info="Duelo é quando um dos dois elimina o outro (sem contar team kill), somando todas as partidas da base. À esquerda, o placar contra cada adversário; à direita, os duelos vencidos contra cada agente, comparados com a média do próprio jogador.">
          <DuelsPanel duels={p.duels} />
        </Section>

        <Section id="quando-morre" title="Quando morre no round" collapsible
                 teaser={p.death_timing ? `Metade das mortes até ${clock(p.death_timing.median * 1000)} (${referenceLabel(p.death_timing)}: ${clock(p.death_timing.league_median * 1000)})` : "Disponível a partir de 25 mortes"}
                 info="Em que momento do round o jogador morre, contado desde a queda da barreira. A referência é a liga na mesma função de agente, porque duelistas morrem mais cedo por definição. É uma comparação descritiva: mostra o padrão, sem afirmar que é melhor ou pior.">
          {p.death_timing ? <DeathTimingPanel timing={p.death_timing} /> : <p className="text-sm text-ink-2">Disponível a partir de 25 mortes.</p>}
        </Section>

        <Section id="habilidades" title="Habilidades" collapsible
                 teaser={p.abilities.length ? `${p.abilities[0].agent}: ${num(p.abilities[0].ult.per_map, 1)} ultimates por mapa (média do agente: ${num(p.abilities[0].ult.league, 1)})` : "Disponível com 2+ mapas no mesmo agente"}
                 info="Quantas vezes o jogador usou cada habilidade por round, e a ultimate por mapa, comparado com a média de quem joga o mesmo agente na liga. A Riot informa só o total por partida: não dá para saber em que momento do round cada habilidade foi usada.">
          {p.abilities.length ? <AbilitiesPanel abilities={p.abilities} /> : <p className="text-sm text-ink-2">Disponível com 2 ou mais mapas no mesmo agente.</p>}
        </Section>

        <Section id="partidas" title="Impacto partida a partida" collapsible
                 teaser={`Impacto positivo em ${posMatches} de ${p.matches.length} partidas · ataque ${pp(imp.wpa_pr_atk)} · defesa ${pp(imp.wpa_pr_def)} por round`}
                 info="Cada barra é uma partida, em ordem cronológica: a soma do impacto do jogador naquele mapa. Passe o mouse (ou toque) numa barra para ver adversário, mapa e agente.">
          <MatchImpactChart matches={p.matches} />
        </Section>

        {p.stages.length > 1 && (
          <Section id="evolucao" title="Evolução no campeonato" collapsible teaser={`${p.stages.length} etapas · ${p.stages.map((x) => `${x.etapa.split(" · ").at(-1)} ${pp(x.wpa_per_round)}`).slice(-2).join(" · ")}`}
                   info="Impacto médio por round em cada etapa. Etapas com poucos rounds variam muito; compare com cautela.">
            <div className="divide-y divide-line/50">
              {p.stages.map((x) => (
                <div key={`${x.etapa}-${x.team}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2 sm:grid-cols-[18rem_minmax(0,1fr)_6rem]">
                  <div>
                    <div className="text-sm text-ink">{x.etapa}</div>
                    <div className="text-xs text-muted">{x.rounds} rounds{p.teams.length > 1 ? ` · ${p.teams.find((t) => t.slug === x.team)?.name ?? x.team}` : ""}</div>
                  </div>
                  <WpaBar value={x.wpa_per_round} max={Math.max(...p.stages.map((y) => Math.abs(y.wpa_per_round)), 1)} />
                  <span className={`tabular hidden text-right text-sm sm:block ${x.rounds < 60 ? "text-muted" : "text-ink-2"}`}>K/D {num(x.kd, 2)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section id="jogadas" title="Jogadas para revisar" collapsible
                 teaser={best ? `Maior jogada: ${pct(best.wp_before)} → ${pct(best.wp_after)} de chance no ${best.map}, round ${best.round}` : "Sem registros"}
                 info="As jogadas que mais mudaram a chance de vitória do time, e as mortes que mais custaram. Cada linha abre o round na tela da partida.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="label-caps mb-1 text-[10px] text-muted">Que mais mudaram rounds</h3>
              <MomentList items={p.best_plays} kind="play" />
            </div>
            <div>
              <h3 className="label-caps mb-1 text-[10px] text-muted">Mortes que mais custaram</h3>
              <MomentList items={p.costliest_deaths} kind="death" />
            </div>
          </div>
        </Section>

        <Section id="agentes" title="Agentes e mapas" collapsible
                 teaser={[bestAgent && `Mais impacto de ${bestAgent.agent} (${pp(bestAgent.wpa_per_round)}/round)`, bestMap && `melhor mapa: ${bestMap.map}`].filter(Boolean).join(" · ") || `${p.agents.length} agentes`}
                 info="Desempenho por agente e por mapa. O impacto por round compara situações diferentes; agentes e mapas com poucos rounds variam muito.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><Th>Agente</Th><Th right>Mapas</Th><Th right>K/D</Th><Th right className="hidden sm:table-cell">ACS</Th><Th>Impacto / round</Th></tr></thead>
                <tbody>
                  {p.agents.map((a) => (
                    <tr key={a.agent}>
                      <Td><span className="flex items-center gap-2">{a.icon && <img src={a.icon} alt="" className="h-6 w-6 rounded" />}{a.agent}</span></Td>
                      <Td right>{a.maps}</Td><Td right>{num(a.kd, 2)}</Td><Td right className="hidden sm:table-cell">{num(a.acs)}</Td>
                      <Td><WpaBar value={a.wpa_per_round} max={maxAgent} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><Th>Mapa</Th><Th right className="hidden sm:table-cell">Mapas</Th><Th right>Vitórias</Th><Th right>K/D</Th><Th>Impacto / round</Th></tr></thead>
                <tbody>
                  {p.maps.map((m) => (
                    <tr key={m.map}>
                      <Td>{m.map}</Td><Td right className="hidden sm:table-cell">{m.maps}</Td><Td right>{pct(m.map_win_rate)}</Td><Td right>{num(m.kd, 2)}</Td>
                      <Td><WpaBar value={m.wpa_per_round} max={maxMap} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <Section id="parceiros" title="Parceiros" collapsible
                 teaser={topPartner ? `Mais trades com ${nick(topPartner.name)}: ${topPartner.they_traded_you + topPartner.you_traded_them} nos dois sentidos` : "Sem parceiros com rounds suficientes"}
                 info="Trades em até 5 s entre o jogador e cada parceiro, nos dois sentidos. Entre parênteses: a parcela das mortes do jogador (com o parceiro vivo) que o parceiro vingou.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead><tr><Th className="sticky left-0 z-10 bg-surface">Parceiro</Th><Th right>Rounds juntos</Th><Th right>Parceiro vingou o jogador</Th><Th right>Jogador vingou o parceiro</Th><Th right>Assistências nas kills do jogador</Th></tr></thead>
              <tbody>
                {p.partners.map((x) => (
                  <tr key={x.puuid}>
                    <Td className="sticky left-0 z-10 bg-surface"><PlayerLink puuid={x.puuid} name={nick(x.name)} /></Td>
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
      </div>
    </main>
  );
}

function MomentList({ items, kind }: { items: Moment[]; kind: "play" | "death" }) {
  if (!items.length) return <p className="text-sm text-ink-2">Sem registros.</p>;
  const verb = (m: Moment) => m.event === "plant" ? "Plantou a spike" : m.event === "defuse" ? "Desarmou a spike"
    : m.event === "revive" ? (m.other ? `Reviveu ${nick(m.other)} com a ultimate` : "Voltou ao round com a própria ultimate") : kind === "play" ? `Matou ${nick(m.other)}${m.weapon ? ` (${m.weapon})` : ""}` : `Morreu para ${nick(m.other)}`;
  return (
    <ul className="divide-y divide-line/50">
      {items.map((m) => (
        <li key={`${m.match_id}-${m.round}-${m.t}`}>
          <Link href={`/partidas/${m.match_id}#round-${m.round}@${(m.t / 1000).toFixed(1)}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-surface-2">
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

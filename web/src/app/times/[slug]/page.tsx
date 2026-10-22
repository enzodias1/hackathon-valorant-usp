import Link from "next/link";
import type { Metadata } from "next";
import ExportPdf from "@/components/site/ExportPdf";
import { pageMeta } from "@/lib/site";
import { getIndex, getModel, getNavGrid, getTeam, getZones } from "@/lib/data";
import { BUY_LEGEND, DECISION_LEGEND, glossary } from "@/lib/glossary";
import { competitionLabel, date, nick, num, pct } from "@/lib/format";
import type { Comparison, Team, TeamMetric } from "@/lib/types";
import SynergyGraph from "@/components/analise/SynergyGraph";
import ZonesPanel from "@/components/analise/ZonesPanel";
import { BandButton, CompareLegend, CompareRow, InsightPanel, PageBand, PlayerLink, Section, StageRow, StatTile, Td, TermList, Th, WpaBar } from "@/components/analise/ui";

// só as páginas geradas no build existem; outro id vira 404 (site 100% estático)
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getIndex()).team_list.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const team = await getTeam((await params).slug);
  const r = team.record;
  return pageMeta(`${team.name} · Analista UNIVAVÁ`,
    `${r.map_wins}V ${r.maps - r.map_wins}D em ${r.maps} mapas · ${pct(r.round_win)} dos rounds · ${team.strength.rank}º de ${team.strength.of} em força. ` +
    "Diagnóstico comparado com a liga, quem cobre quem e os rounds que decidiram os jogos.");
}

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Geral", keys: ["round_win", "atk_win", "def_win"] },
  { title: "Pistol e economia", keys: ["pistol_win", "bonus_conv", "anti_bonus"] },
  { title: "Primeiro duelo", keys: ["fb_rate", "win_after_fb", "win_after_fd"] },
  { title: "Spike", keys: ["postplant_win", "retake_win"] },
  { title: "Fechar e virar rounds", keys: ["throw_rate", "comeback_rate"] },
  { title: "Jogo coletivo", keys: ["traded_death_rate", "isolated_death_rate"] },
];

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [team, zones]: [Team, Awaited<ReturnType<typeof getZones>>] = await Promise.all([getTeam(slug), getZones(slug)]);
  const g = glossary(await getModel());
  const metric = Object.fromEntries(team.metrics.map((m) => [m.key, m])) as Record<string, TeamMetric>;
  const wae = team.wins_above_expected;
  const maxWpa = Math.max(...team.roster.map((p) => Math.abs(p.wpa_per_round)));
  const small = team.record.rounds < 100;
  const t = teasers(team, zones);
  // chão e regiões nomeadas de cada mapa do time (para escrever os nomes no mapa de calor e acender a área de cada região)
  const navs = Object.fromEntries(await Promise.all(zones.maps.map(async (m) => [m.code, await getNavGrid(m.code)] as const)));

  return (
    <main>
      <PageBand back={{ href: "/times", label: "Times" }} kicker={`Força ${team.strength.rank}º de ${team.strength.of}`} title={team.name}
                actions={<>
                  <BandButton href={`/comparar?a=${team.slug}`} primary>Comparar com outro time</BandButton>
                  <BandButton href={`/partidas?time=${team.slug}`}>Ver partidas</BandButton>
                  <ExportPdf title={team.name} />
                </>}>
        {team.institution && <p className="text-sm">{team.institution}</p>}
        <p className="label-caps mt-1 text-[11px] text-white/70">
          {team.record.map_wins}V · {team.record.maps - team.record.map_wins}D em {team.record.maps} mapas · {pct(team.record.round_win)} dos rounds
        </p>
      </PageBand>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-8">
        {small && (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
            <span className="font-bold text-warn">!</span> Amostra pequena ({team.record.rounds} rounds): a maioria das comparações ainda não é conclusiva.
          </p>
        )}

        <div data-pdf-section="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Mapas" value={`${team.record.map_wins}V · ${team.record.maps - team.record.map_wins}D`} sub={`${team.record.maps} mapas jogados`} />
          <StatTile label="Rounds vencidos" value={pct(team.record.round_win)} sub={`${team.record.rounds} rounds`} />
          <StatTile label="Rounds além da economia" value={`${wae.diff >= 0 ? "+" : "−"}${num(Math.abs(wae.diff))}`}
                    tone={wae.significant ? (wae.diff > 0 ? "good" : "bad") : undefined}
                    sub={`${wae.per100 >= 0 ? "+" : ""}${num(wae.per100, 1)} a cada 100 rounds${wae.significant ? "" : " · não conclusivo"}`} />
          <StatTile label="Força na liga" value={`${team.strength.rank}º de ${team.strength.of}`}
                    info={<TermList terms={[g.strength]} className="" />} infoAlign="right"
                    sub={team.strength.reliable ? `vence ${pct(team.strength.p_vs_avg)} dos rounds contra um time médio` : "poucos rounds: estimativa imprecisa"} />
        </div>

        <Section id="diagnostico" title="Diagnóstico" collapsible defaultOpen
                 info="Comparação com a média da liga. Só viram ponto forte ou fraco as diferenças estatisticamente confiáveis para o tamanho da amostra, já com controle de falsos positivos.">
          <InsightPanel insights={team.insights} />
        </Section>

        <Section id="sinergia" title="Sinergia: quem cobre quem" collapsible teaser={t.synergy}
                 info="Trade = vingar a morte de um aliado em até 5 segundos. Cada linha do grafo é uma dupla: quanto mais grossa, mais vezes um vingou a morte do outro. Duplas que se cobrem transformam mortes em duelos trocados.">
          <SynergyGraph synergy={team.synergy} />
        </Section>

        <Section id="zonas" title="Onde o time morre" collapsible teaser={t.zones}
                 info={<>Cada morte é atribuída à região nomeada mais próxima do mapa. A tabela compara a parcela de mortes em cada região com a da liga e mostra quantas ficaram sem trade; o mapa de calor mostra onde elas se concentram.<TermList terms={[g.trade]} /></>}>
          <ZonesPanel zones={zones} navs={navs} />
        </Section>

        <Section id="elenco" title="Elenco" collapsible teaser={t.roster}
                 info={<>Função: a do agente que o jogador mais usou. Esmaecidos: menos de 20% dos rounds do time.<TermList terms={[g.impactPerRound]} /></>}>
          <div className="overflow-x-auto">
            <table className="w-full sm:min-w-[760px]">
              <thead><tr><Th className="sticky left-0 z-10 bg-surface">Jogador</Th><Th className="hidden sm:table-cell">Agentes</Th><Th>Função</Th><Th right>Rounds</Th><Th right>K/D</Th><Th right className="hidden sm:table-cell">ACS</Th><Th>Impacto / round</Th><Th right>Mortes trocadas</Th></tr></thead>
              <tbody>
                {team.roster.map((p) => (
                  <tr key={p.puuid} className={p.core ? "" : "opacity-60"}>
                    <Td className="sticky left-0 z-10 bg-surface"><PlayerLink puuid={p.puuid} name={nick(p.name)} /></Td>
                    <Td className="hidden sm:table-cell text-ink-2">{p.agents.join(", ")}</Td>
                    <Td className="whitespace-nowrap">{p.agent_role ?? "—"}</Td>
                    <Td right>{p.rounds}</Td>
                    <Td right>{num(p.kd, 2)}</Td>
                    <Td right className="hidden sm:table-cell">{num(p.acs)}</Td>
                    <Td><WpaBar value={p.wpa_per_round} max={maxWpa} /></Td>
                    <Td right>{pct(p.traded_death_rate)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="evolucao" title="Evolução no campeonato" collapsible teaser={t.evolution}
                 info="Rounds vencidos acima ou abaixo do esperado em cada etapa, a cada 100 rounds. O esperado já desconta a força dos adversários e a economia, então mostra se o time jogou acima do próprio nível. A faixa clara é o intervalo de 90%. Mudanças entre as metades do campeonato só aparecem quando passam no teste estatístico.">
          <Evolution team={team} />
        </Section>

        <Section id="liga" title="Comparação com a liga" collapsible teaser={t.compare} aside={<CompareLegend />}
                 info={<>Cada linha mostra o time (ponto) e a média da liga (traço). ▲/▼ marcam diferenças confirmadas estatisticamente.<TermList terms={[g.throw, g.comeback, g.trade, g.isolated]} /></>}>
          <div className="space-y-5">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <h3 className="label-caps mb-1 text-[10px] text-muted">{g.title}</h3>
                <div className="divide-y divide-line/50">
                  {g.keys.filter((k) => metric[k]).map((k) => <CompareRow key={k} label={metric[k].label} c={metric[k]} />)}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="mapas" title="Mapas" collapsible teaser={t.maps}
                 info="Vitórias por mapa e por lado. Entre parênteses: a vitória média do ataque naquele mapa, na liga.">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Mapa</Th><Th right>Mapas</Th><Th right>Rounds</Th><Th right>Ataque</Th><Th right>Defesa</Th></tr></thead>
              <tbody>
                {team.maps.map((m) => (
                  <tr key={m.map}>
                    <Td>{m.map}</Td>
                    <Td right className="whitespace-nowrap">{m.map_wins}V {m.maps - m.map_wins}D</Td>
                    <Td right>{pct(m.round_win)}</Td>
                    <Td right><span className="text-atk">●</span> {pct(m.atk_win)} <span className="text-muted">({pct(m.league_atk_win)})</span></Td>
                    <Td right><span className="text-def">●</span> {pct(m.def_win)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="economia" title="Economia" collapsible teaser={t.economy}
                 info="Vitórias em cada tipo de compra comparadas com o esperado pelo modelo (que considera a compra dos dois lados), e o que o time fez quando não tinha dinheiro para full buy (dinheiro + armas abaixo de 20 mil). É descritivo: mostra o que aconteceu, sem recomendar uma decisão.">
          <h3 className="label-caps mb-1 text-[10px] text-muted">Vitórias por tipo de compra</h3>
          <p className="mb-2 text-xs text-ink-2">{BUY_LEGEND}</p>
          <div className="divide-y divide-line/50">
            {team.buys.map((b) => {
              const c: Comparison = { value: b.win, league: b.expected, n: b.rounds, z: b.z, significant: b.significant, good: b.significant ? b.z > 0 : null };
              return <CompareRow key={b.buy} label={`${b.buy} (${b.rounds} rounds)`} c={c} expectedLabel="esperado" />;
            })}
          </div>
          <h3 className="label-caps mb-1 mt-6 text-[10px] text-muted">Sem dinheiro para full buy</h3>
          <p className="mb-2 text-xs text-ink-2">{DECISION_LEGEND}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {team.economy.map((e) => (
              <div key={e.context} className="rounded-lg bg-surface-2 p-4">
                <h4 className="text-sm font-medium text-ink">{e.label}</h4>
                {e.n === 0 ? <p className="mt-2 text-sm text-ink-2">Nenhuma situação assim nos dados.</p> : (
                  <>
                    <table className="mt-2 w-full text-sm">
                      <thead><tr className="text-left text-xs text-muted"><th className="py-1">Decisão</th><th className="py-1 text-right">Vezes</th><th className="py-1 text-right">Venceu o round</th><th className="py-1 text-right">Rounds nos 3 seguintes</th></tr></thead>
                      <tbody>
                        {(["Economizar", "Meio-termo", "Forçar"] as const).map((d) => {
                          const x = e.decisions[d];
                          return (
                            <tr key={d} className="border-t border-line/50">
                              <td className="py-1.5 text-ink">{d}</td>
                              <td className="tabular py-1.5 text-right text-ink">{x?.n ?? 0}</td>
                              <td className="tabular py-1.5 text-right text-ink-2">{x ? pct(x.win_now) : "—"}</td>
                              <td className="tabular py-1.5 text-right text-ink-2">{x?.rounds_next3 != null ? num(x.rounds_next3, 1) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {e.n < 5 && <p className="mt-2 text-xs text-muted">Poucas situações para tirar conclusões sobre o time.</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section id="vod" title="Rounds para revisar no VOD" collapsible teaser={t.decisive}
                 info={<><TermList terms={[g.throw, g.comeback]} className="" /><span className="mt-2 block">Cada linha mostra a chance mais alta (jogados fora) ou mais baixa (viradas) que o time teve no round e abre o round na tela da partida.</span></>}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="label-caps mb-1 text-[10px] text-muted">Jogados fora</h3>
              <DecisiveList items={team.decisive.throws} verb="chegou a" />
            </div>
            <div>
              <h3 className="label-caps mb-1 text-[10px] text-muted">Viradas</h3>
              <DecisiveList items={team.decisive.comebacks} verb="caiu a" />
            </div>
          </div>
        </Section>

        <Section id="partidas" title="Partidas" collapsible teaser={t.matches}>
          <div className="overflow-x-auto">
            <table className="w-full sm:min-w-[560px]">
              <thead><tr><Th>Data</Th><Th className="hidden sm:table-cell">Competição</Th><Th>Mapa</Th><Th>Adversário</Th><Th right>Placar</Th></tr></thead>
              <tbody>
                {team.matches.map((m) => (
                  <tr key={m.id}>
                    <Td className="tabular text-ink-2">{date(m.date)}</Td>
                    <Td className="hidden sm:table-cell text-ink-2">{competitionLabel(m.competition, m.stage)}</Td>
                    <Td>{m.map}</Td>
                    <Td><Link href={`/times/${m.opponent}`} className="hover:underline">{m.opponent_name}</Link></Td>
                    <Td right className="whitespace-nowrap">
                      <Link href={`/partidas/${m.id}`} className="hover:underline">
                        <span className={m.won ? "text-good" : "text-bad"}>{m.won ? "V" : "D"}</span> {m.score_for}–{m.score_against}
                      </Link>
                    </Td>
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

/** Prévia de uma linha de cada seção recolhida, calculada dos próprios dados. */
function teasers(team: Team, zones: Awaited<ReturnType<typeof getZones>>) {
  const name = (id: string) => nick(team.synergy.nodes.find((n) => n.puuid === id)?.name);
  const pair = [...team.synergy.edges].sort((a, b) => b.a_traded_b + b.b_traded_a - (a.a_traded_b + a.b_traded_a))[0];
  const map0 = zones.maps[0];
  const side = map0 && (["Defesa", "Ataque"] as const).map((s) => map0.sides[s]).filter(Boolean).sort((a, b) => b!.deaths - a!.deaths)[0];
  const roles = team.roster.filter((p) => p.core && p.agent_role).reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.agent_role!]: (acc[p.agent_role!] ?? 0) + 1 }), {});
  const confirmed = team.evolution.changes.filter((c) => c.significant).length;
  const up = team.metrics.filter((m) => m.significant && m.good).length, down = team.metrics.filter((m) => m.significant && m.good === false).length;
  const bestMap = [...team.maps].filter((m) => m.maps >= 2).sort((a, b) => b.round_win - a.round_win)[0];
  const full = team.buys.find((b) => b.buy === "Full buy");
  const pistolEco = team.economy.find((e) => e.context === "perdeu o pistol");
  const last = team.matches.at(-1);
  return {
    synergy: pair ? `Dupla que mais se cobre: ${name(pair.a)} + ${name(pair.b)} (${pair.a_traded_b + pair.b_traded_a} trades)` : "Poucos rounds juntos para montar o grafo",
    zones: map0 && side ? `${map0.map}: mais mortes em ${side.zones[0]?.zone} (${pct(side.zones[0]?.share)} das mortes na ${side === map0.sides.Defesa ? "defesa" : "ataque"})` : "Sem mortes registradas",
    roster: Object.keys(roles).length ? `Titulares: ${Object.entries(roles).map(([r, n]) => (n > 1 ? `${r} ×${n}` : r)).join(" · ")}` : `${team.roster.length} jogadores`,
    evolution: !team.evolution.available ? "Menos de 8 mapas: ainda não dá para comparar períodos"
      : confirmed ? `${confirmed} ${confirmed === 1 ? "mudança confirmada" : "mudanças confirmadas"} entre as metades do campeonato` : "Nenhuma mudança confirmada entre as metades do campeonato",
    compare: up || down ? `${up} acima da liga · ${down} abaixo da liga (confirmados)` : "Nenhuma diferença confirmada em relação à liga",
    maps: bestMap ? `Melhor mapa: ${bestMap.map} (${pct(bestMap.round_win)} dos rounds em ${bestMap.maps} mapas)` : `${team.maps.length} mapas diferentes`,
    economy: [full && `Full buy: ${pct(full.win)} de vitória (esperado ${pct(full.expected)})`, pistolEco?.insight].filter(Boolean).join(" · "),
    decisive: `${team.decisive.throws.length} rounds jogados fora · ${team.decisive.comebacks.length} viradas`,
    matches: last ? `${team.matches.length} mapas · último: vs ${last.opponent_name} (${last.won ? "V" : "D"} ${last.score_for}–${last.score_against})` : "",
  };
}

function Evolution({ team }: { team: Team }) {
  const ev = team.evolution;
  const confirmed = ev.changes.filter((c) => c.significant);
  return (
    <div className="space-y-5">
      <div className="divide-y divide-line/50">
        {ev.stages.map((s) => (
          <StageRow key={s.etapa} label={s.etapa} sub={`${s.maps} mapas · ${pct(s.round_win)} dos rounds · adversários: ${pct(s.opp_strength)} contra um time médio`}
                    value={s.above_level_per100} se={s.above_level_se100} />
        ))}
      </div>
      {ev.available ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-ink-2">
            O que mudou: primeira metade ({ev.periods!.before}, {ev.periods!.maps_before} mapas) × segunda metade ({ev.periods!.after}, {ev.periods!.maps_after} mapas)
          </h3>
          {confirmed.length ? (
            <ul className="space-y-2">
              {confirmed.map((c) => (
                <li key={c.key} className="flex gap-3 rounded-lg bg-surface-2 p-3 text-sm">
                  <span className={`font-bold ${c.improved ? "text-good" : "text-bad"}`} aria-hidden>{c.improved ? "▲" : "▼"}</span>
                  <span className="text-ink">{c.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">
              Nenhuma mudança confirmada estatisticamente. As diferenças entre as duas metades estão dentro do que o acaso explicaria com essa quantidade de mapas.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-2">Menos de 8 mapas: ainda não dá para comparar períodos.</p>
      )}
    </div>
  );
}

function DecisiveList({ items, verb }: { items: Team["decisive"]["throws"]; verb: string }) {
  if (!items.length) return <p className="text-sm text-ink-2">Nenhum round assim.</p>;
  return (
    <ul className="divide-y divide-line/50">
      {items.map((r) => (
        <li key={`${r.match_id}-${r.round}`}>
          <Link href={`/partidas/${r.match_id}#round-${r.round}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-surface-2">
            <span className="text-ink">Round {r.round} · {r.map} · vs {r.opponent_name}</span>
            <span className="tabular shrink-0 text-ink-2">
              <span className={r.side === "Ataque" ? "text-atk" : "text-def"}>●</span> {r.side} · {verb} <span className="text-ink">{pct(r.wp)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { getIndex, getTeam } from "@/lib/data";
import { competitionLabel, date, nick, num, pct } from "@/lib/format";
import type { Comparison, Team, TeamMetric } from "@/lib/types";
import SynergyGraph from "@/components/analise/SynergyGraph";
import { Badge, CompareLegend, CompareRow, InsightPanel, PlayerLink, Section, StatTile, Td, Th, WpaBar } from "@/components/analise/ui";

// só as páginas geradas no build existem; outro id vira 404 (site 100% estático)
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getIndex()).team_list.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const team = await getTeam((await params).slug);
  return { title: `${team.name} · Analista UNIVAVÁ` };
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
  const team: Team = await getTeam((await params).slug);
  const metric = Object.fromEntries(team.metrics.map((m) => [m.key, m])) as Record<string, TeamMetric>;
  const wae = team.wins_above_expected;
  const maxWpa = Math.max(...team.roster.map((p) => Math.abs(p.wpa_per_round)));
  const small = team.record.rounds < 100;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <Link href="/times" className="text-sm text-muted hover:text-ink-2">← Times</Link>
        <h1 className="text-3xl font-bold text-ink">{team.name}</h1>
        {team.institution && <p className="text-ink-2">{team.institution}</p>}
        {small && (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
            <span className="font-bold text-warn">!</span> Amostra pequena ({team.record.rounds} rounds): a maioria das comparações ainda não é conclusiva.
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Mapas" value={`${team.record.map_wins}V · ${team.record.maps - team.record.map_wins}D`} sub={`${team.record.maps} mapas jogados`} />
        <StatTile label="Rounds vencidos" value={pct(team.record.round_win)} sub={`${team.record.rounds} rounds`} />
        <StatTile label="Rounds além da economia" value={`${wae.diff >= 0 ? "+" : "−"}${num(Math.abs(wae.diff))}`}
                  tone={wae.significant ? (wae.diff > 0 ? "good" : "bad") : undefined}
                  sub={`${wae.per100 >= 0 ? "+" : ""}${num(wae.per100, 1)} a cada 100 rounds${wae.significant ? "" : " · não conclusivo"}`} />
        <StatTile label="Titulares" value={team.synergy.nodes.length} sub={`${team.roster.length} jogadores no total`} />
      </div>

      <Section title="Diagnóstico" subtitle="Comparação com a média da liga. Só viram ponto forte ou fraco as diferenças estatisticamente confiáveis para o tamanho da amostra.">
        <InsightPanel insights={team.insights} />
      </Section>

      <Section title="Sinergia: quem cobre quem" subtitle="Trade = vingar a morte de um aliado em até 5 segundos. Duplas que se cobrem transformam mortes em duelos trocados.">
        <SynergyGraph synergy={team.synergy} />
      </Section>

      <Section title="Comparação com a liga" subtitle="Cada linha mostra o time (ponto) e a média da liga (traço)." aside={<CompareLegend />}>
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{g.title}</h3>
              <div className="divide-y divide-line/50">
                {g.keys.filter((k) => metric[k]).map((k) => <CompareRow key={k} label={metric[k].label} c={metric[k]} />)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Elenco e papéis" subtitle="Papel em jogo = descoberto pelo comportamento (entradas, distância do time, trades, clutches), não pelo agente. Impacto = quanto o jogador muda a chance de vitória do round, em média.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr><Th>Jogador</Th><Th>Agentes</Th><Th>Função do agente → papel em jogo</Th><Th right>Rounds</Th><Th right>K/D</Th><Th right>ACS</Th><Th>Impacto / round</Th><Th right>Mortes trocadas</Th></tr></thead>
            <tbody>
              {team.roster.map((p) => (
                <tr key={p.puuid} className={p.core ? "" : "opacity-60"}>
                  <Td><PlayerLink puuid={p.puuid} name={nick(p.name)} /></Td>
                  <Td className="text-ink-2">{p.agents.join(", ")}</Td>
                  <Td>{p.agent_role ?? "—"} {p.behavior_role && <>→ <Badge>{p.behavior_role}</Badge></>}</Td>
                  <Td right>{p.rounds}</Td>
                  <Td right>{num(p.kd, 2)}</Td>
                  <Td right>{num(p.acs)}</Td>
                  <Td><WpaBar value={p.wpa_per_round} max={maxWpa} /></Td>
                  <Td right>{pct(p.traded_death_rate)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Esmaecidos: jogadores com menos de 20% dos rounds do time.</p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Mapas" subtitle="Vitórias por mapa e por lado.">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Mapa</Th><Th right>Mapas</Th><Th right>Rounds</Th><Th right>Ataque</Th><Th right>Defesa</Th></tr></thead>
              <tbody>
                {team.maps.map((m) => (
                  <tr key={m.map}>
                    <Td>{m.map}</Td>
                    <Td right>{m.map_wins}V {m.maps - m.map_wins}D</Td>
                    <Td right>{pct(m.round_win)}</Td>
                    <Td right><span className="text-atk">●</span> {pct(m.atk_win)} <span className="text-muted">({pct(m.league_atk_win)})</span></Td>
                    <Td right><span className="text-def">●</span> {pct(m.def_win)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Entre parênteses: vitória média do ataque naquele mapa, na liga.</p>
        </Section>

        <Section title="Economia" subtitle="Vitórias por tipo de compra do time vs. o esperado pelo modelo (que considera a compra dos dois lados).">
          <div className="divide-y divide-line/50">
            {team.buys.map((b) => {
              const c: Comparison = { value: b.win, league: b.expected, n: b.rounds, z: b.z, significant: b.significant, good: b.significant ? b.z > 0 : null };
              return <CompareRow key={b.buy} label={`${b.buy} (${b.rounds} rounds)`} c={c} expectedLabel="esperado" />;
            })}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Rounds jogados fora" subtitle="O time chegou a esta chance de vitória e perdeu o round. Os melhores rounds para revisar no VOD.">
          <DecisiveList items={team.decisive.throws} verb="chegou a" />
        </Section>
        <Section title="Viradas" subtitle="O time caiu a esta chance de vitória e venceu o round.">
          <DecisiveList items={team.decisive.comebacks} verb="caiu a" />
        </Section>
      </div>

      <Section title="Partidas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr><Th>Data</Th><Th>Competição</Th><Th>Mapa</Th><Th>Adversário</Th><Th right>Placar</Th></tr></thead>
            <tbody>
              {team.matches.map((m) => (
                <tr key={m.id}>
                  <Td className="tabular text-ink-2">{date(m.date)}</Td>
                  <Td className="text-ink-2">{competitionLabel(m.competition, m.stage)}</Td>
                  <Td>{m.map}</Td>
                  <Td><Link href={`/times/${m.opponent}`} className="hover:underline">{m.opponent_name}</Link></Td>
                  <Td right>
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
    </main>
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

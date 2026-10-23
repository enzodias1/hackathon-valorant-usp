// "As brabas": só as partidas da Rush Series Inclusivo (13 mapas, 7 times). Tudo é calculado aqui a partir das partidas, sem
// misturar os outros campeonatos: quem também jogou o UNIVAVÁ aparece só com o que fez no Inclusivo.
import type { Metadata } from "next";
import { getIndex, getMatch, getModel } from "@/lib/data";
import { glossary } from "@/lib/glossary";
import { nick, num, pct } from "@/lib/format";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import type { Color } from "@/lib/types";
import { PageBand, PlayerLink, SectionHead, Td, TeamLink, TermList, Th, WpaBar } from "@/components/analise/ui";
import InfoTip from "@/components/analise/InfoTip";

const COMPETITION = "Rush Series Inclusivo";
const TOP = 10;
const MIN_MAPS = 2; // duas jogaram só parte de um mapa (21 e 22 rounds)

export const metadata: Metadata = pageMeta(`As brabas · ${PRODUCT_NAME}`,
  "As 10 jogadoras de maior impacto da Rush Series Inclusivo e os times.");

type Row = {
  puuid: string; name: string; team: string; maps: number; rounds: number; kills: number; deaths: number; assists: number;
  acsSum: number; wpa: number; agents: Map<string, { n: number; icon: string | null }>;
};

export default async function BrabasPage() {
  const [index, model] = await Promise.all([getIndex(), getModel()]);
  const g = glossary(model);
  const list = index.matches.filter((m) => m.competition === COMPETITION);
  const matches = await Promise.all(list.map((m) => getMatch(m.id)));

  const players = new Map<string, Row>();
  const teams = new Map<string, { maps: number; wins: number; rw: number; rt: number }>();
  const h2h = new Map<string, number>(); // "a|b" -> mapas que a venceu contra b
  matches.forEach((m, i) => {
    const slug: Record<Color, string> = { Red: list[i].red, Blue: list[i].blue };
    const rounds = m.score.Red + m.score.Blue;
    for (const c of ["Red", "Blue"] as Color[]) {
      const t = teams.get(slug[c]) ?? { maps: 0, wins: 0, rw: 0, rt: 0 };
      t.maps += 1; t.wins += m.winner === c ? 1 : 0; t.rw += m.score[c]; t.rt += rounds;
      teams.set(slug[c], t);
    }
    const w = slug[m.winner], l = slug[m.winner === "Red" ? "Blue" : "Red"];
    h2h.set(`${w}|${l}`, (h2h.get(`${w}|${l}`) ?? 0) + 1);
    for (const p of m.players) {
      const r = players.get(p.puuid) ?? { puuid: p.puuid, name: p.name, team: slug[p.color], maps: 0, rounds: 0, kills: 0, deaths: 0, assists: 0, acsSum: 0, wpa: 0, agents: new Map() };
      r.maps += 1; r.rounds += rounds; r.kills += p.kills; r.deaths += p.deaths; r.assists += p.assists; r.acsSum += p.acs * rounds; r.wpa += p.wpa;
      const a = r.agents.get(p.agent) ?? { n: 0, icon: p.agent_icon };
      a.n += 1; r.agents.set(p.agent, a);
      players.set(p.puuid, r);
    }
  });

  const ranked = [...players.values()].filter((r) => r.maps >= MIN_MAPS).sort((a, b) => b.wpa / b.rounds - a.wpa / a.rounds);
  const top = ranked.slice(0, TOP);
  const maxWpa = Math.max(...top.map((r) => Math.abs(r.wpa / r.rounds)), 0.1);
  // vitórias, depois o confronto direto (o Azure venceu a USP), depois a % de rounds
  const teamRows = [...teams.entries()].sort((a, b) => b[1].wins / b[1].maps - a[1].wins / a[1].maps
    || (h2h.get(`${b[0]}|${a[0]}`) ?? 0) - (h2h.get(`${a[0]}|${b[0]}`) ?? 0)
    || b[1].rw / b[1].rt - a[1].rw / a[1].rt);
  const teamName = (slug: string) => index.teams[slug]?.name ?? slug;
  // K/D como na lista de jogadores (aba do Inclusivo) e na página da jogadora: uma morte por round (o placar da partida conta
  // de novo quem é revivida e morre outra vez, e não conta quem se mata com a própria habilidade)
  const kdOf = new Map(index.players.map((p) => [p.puuid, p.by_competition?.[COMPETITION]?.kd]));
  const mainAgent = (r: Row) => [...r.agents.entries()].sort((a, b) => b[1].n - a[1].n)[0];

  return (
    <main>
      <PageBand kicker={`${COMPETITION} · 2026`} title="As brabas">
        Não dava pra deixar de fora as brabas do cenário inclusivo universitário. Em homenagem ao Game Changers Championship acontecendo no Brasil,
        separamos as {matches.length} partidas da {COMPETITION}: {teams.size} times, {players.size} jogadoras e muita mira envolvida.
      </PageBand>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-8">
        <section>
          <SectionHead n="01" title={`As ${TOP} de maior impacto`}
                       info={<InfoTip text={<>Ranking pelo impacto por round só nas partidas da {COMPETITION}, com pelo menos {MIN_MAPS} mapas.
                         <TermList terms={[g.impact, g.impactPerRound]} /></>} />} />
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full sm:min-w-[760px]">
              <thead>
                <tr><Th>#</Th><Th>Jogadora</Th><Th className="hidden sm:table-cell">Time</Th><Th right className="hidden sm:table-cell">Mapas</Th>
                  <Th right>K/D</Th><Th right className="hidden sm:table-cell">ACS</Th><Th>Impacto por round</Th></tr>
              </thead>
              <tbody>
                {top.map((r, i) => {
                  const [agent, a] = mainAgent(r);
                  return (
                    <tr key={r.puuid}>
                      <Td><span className={`font-display text-xl ${i < 3 ? "text-lime" : "text-ink-2"}`}>{i + 1}</span></Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {a.icon && <img src={a.icon} alt={agent} title={agent} className="h-7 w-7 shrink-0 rounded" />}
                          <span className="min-w-0">
                            <PlayerLink puuid={r.puuid} name={nick(r.name)} />
                            <span className="block text-xs text-muted sm:hidden">{teamName(r.team)}</span>
                          </span>
                        </span>
                      </Td>
                      <Td className="hidden sm:table-cell"><TeamLink slug={r.team} name={teamName(r.team)} /></Td>
                      <Td right className="hidden sm:table-cell">{r.maps}</Td>
                      <Td right>{num(kdOf.get(r.puuid) ?? r.kills / Math.max(r.deaths, 1), 2)}</Td>
                      <Td right className="hidden sm:table-cell">{num(r.acsSum / r.rounds)}</Td>
                      <Td><WpaBar value={r.wpa / r.rounds} max={maxWpa} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            O número de cada jogadora vale só para a {COMPETITION}; a página dela soma todos os campeonatos.
          </p>
        </section>

        <section>
          <SectionHead n="02" title="Os times" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teamRows.map(([slug, t]) => (
              <div key={slug} className="rounded-xl border border-line bg-surface p-4">
                <TeamLink slug={slug} name={teamName(slug)} />
                <p className="font-display mt-2 text-3xl text-ink">{t.wins}V · {t.maps - t.wins}D</p>
                <p className="text-xs text-ink-2">{pct(t.rw / t.rt)} dos rounds{t.wins === t.maps ? " · invicto" : ""}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

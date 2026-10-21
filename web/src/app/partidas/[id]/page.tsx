import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { getIndex, getMatch } from "@/lib/data";
import { clock, competitionLabel, date, nick, num, pct, pp } from "@/lib/format";
import type { Color, Match } from "@/lib/types";
import MatchView from "@/components/analise/MatchView";
import { PlayerLink, Section, TeamLink, Td, Th, WpaBar } from "@/components/analise/ui";

// só as páginas geradas no build existem; outro id vira 404 (site 100% estático)
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getIndex()).matches.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await getMatch((await params).id);
  return pageMeta(`${m.teams.Red.name} ${m.score.Red}–${m.score.Blue} ${m.teams.Blue.name} · ${m.map.name}`,
    `${competitionLabel(m.competition, m.stage)} · ${date(m.date)}. Chance de vitória round a round e as jogadas que decidiram o mapa.`);
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const match: Match = await getMatch((await params).id);
  const maxWpa = Math.max(...match.players.map((p) => Math.abs(p.wpa)));
  const name = Object.fromEntries(match.players.map((p) => [p.puuid, p]));
  // jogadas que mais mudaram rounds na partida
  const key = match.rounds
    .flatMap((r) => r.events.filter((e) => !e.after_round_end && e.actor).map((e) => ({ r, e })))
    .sort((a, b) => Math.abs(b.e.wpa) - Math.abs(a.e.wpa))
    .slice(0, 6);
  const mvp = [...match.players].sort((a, b) => b.wpa - a.wpa)[0];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-3">
        <Link href="/partidas" className="text-sm text-muted hover:text-ink-2">← Partidas</Link>
        <p className="text-sm text-ink-2">{competitionLabel(match.competition, match.stage)} · {date(match.date)} · {match.map.name} · {num(match.length_min)} min</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <TeamHeader match={match} c="Red" />
          <span className="tabular text-4xl font-bold text-ink">{match.score.Red} <span className="text-muted">–</span> {match.score.Blue}</span>
          <TeamHeader match={match} c="Blue" />
        </div>
        <p className="text-sm text-ink-2">
          Maior impacto da partida: <PlayerLink puuid={mvp.puuid} name={nick(mvp.name)} /> ({mvp.agent}) com <span className="text-good">{pp(mvp.wpa, 0)}</span> somados nos rounds.
        </p>
      </header>

      <MatchView match={match} />

      <Section title="Jogadas que mais mudaram rounds" subtitle="Chance de vitória do time de quem agiu, antes → depois.">
        <ul className="divide-y divide-line/50">
          {key.map(({ r, e }, i) => {
            const p = name[e.actor!];
            const mine = p?.color === "Blue" ? [1 - e.wp_red_before, 1 - e.wp_red_after] : [e.wp_red_before, e.wp_red_after];
            const what = e.type === "plant" ? "plantou a spike" : e.type === "defuse" ? "desarmou a spike" : `matou ${nick(name[e.victim ?? ""]?.name)}${e.weapon ? ` (${e.weapon})` : ""}`;
            return (
              <li key={i}>
                <a href={`#round-${r.n}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-surface-2">
                  <span>
                    <span className={p?.color === "Red" ? "text-team-red" : "text-team-blue"}>●</span>{" "}
                    <span className="text-ink">{nick(p?.name)} {what}</span>
                    <span className="block text-xs text-muted">round {r.n} · {clock(e.t)}</span>
                  </span>
                  <span className="tabular shrink-0 text-right">
                    <span className="text-ink-2">{pct(mine[0])} → {pct(mine[1])}</span>
                    <span className={`block text-xs ${e.wpa >= 0 ? "text-good" : "text-bad"}`}>{pp(e.wpa)}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {(["Red", "Blue"] as Color[]).map((c) => (
          <Section key={c} title={match.teams[c].name} subtitle={c === match.winner ? "Vencedor" : "Derrota"}>
            <div className="overflow-x-auto">
              <table className="w-full sm:min-w-[480px]">
                <thead><tr><Th>Jogador</Th><Th right>K / D / A</Th><Th right className="hidden sm:table-cell">ACS</Th><Th right className="hidden sm:table-cell">ADR</Th><Th>Impacto</Th></tr></thead>
                <tbody>
                  {match.players.filter((p) => p.color === c).sort((a, b) => b.wpa - a.wpa).map((p) => (
                    <tr key={p.puuid}>
                      <Td>
                        <span className="flex items-center gap-2">
                          {p.agent_icon && <img src={p.agent_icon} alt={p.agent} title={p.agent} className="h-7 w-7 rounded" />}
                          <PlayerLink puuid={p.puuid} name={nick(p.name)} />
                        </span>
                      </Td>
                      <Td right className="whitespace-nowrap">{p.kills} / {p.deaths} / {p.assists}</Td>
                      <Td right className="hidden sm:table-cell">{num(p.acs)}</Td>
                      <Td right className="hidden sm:table-cell">{num(p.adr)}</Td>
                      <Td><WpaBar value={p.wpa} max={maxWpa} digits={0} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ))}
      </div>
      <p className="text-xs text-muted">Impacto: soma, em pontos percentuais, de quanto as ações do jogador mudaram a chance de vitória dos rounds desta partida.</p>
    </main>
  );
}

function TeamHeader({ match, c }: { match: Match; c: Color }) {
  const t = match.teams[c];
  return (
    <span className="flex items-center gap-2 text-2xl font-semibold">
      <span className={`h-3 w-3 rounded-full ${c === "Red" ? "bg-team-red" : "bg-team-blue"}`} />
      <TeamLink slug={t.slug} name={t.name} />
      {match.winner === c && <span className="text-sm font-normal text-good">✓ vitória</span>}
    </span>
  );
}

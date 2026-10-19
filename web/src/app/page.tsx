import Link from "next/link";
import { getIndex } from "@/lib/data";
import { competitionLabel, date, num, pct } from "@/lib/format";
import { Section, StatTile, Td, Th } from "@/components/analise/ui";

const FEATURES = [
  {
    href: "/partidas",
    title: "Partidas",
    text: "A chance de vitória do round a cada kill, os rounds que viraram e as jogadas que decidiram o mapa.",
  },
  {
    href: "/times",
    title: "Times",
    text: "Diagnóstico comparado com a liga, quem cobre quem (trades) e onde o time joga rounds fora.",
  },
  {
    href: "/jogadores",
    title: "Jogadores",
    text: "Impacto real além do K/D e o papel que cada um de fato exerce, descoberto pelo comportamento.",
  },
];

export default async function Home() {
  const index = await getIndex();
  const rounds = index.team_list.reduce((s, t) => s + t.rounds, 0) / 2;
  const topTeams = [...index.team_list].sort((a, b) => b.maps - a.maps || b.round_win - a.round_win).slice(0, 5);
  const recent = [...index.matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const teamName = (slug: string) => index.teams[slug]?.name ?? slug;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="max-w-3xl space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Análise pós-partida para o VALORANT universitário</p>
        <h1 className="text-4xl font-bold leading-tight text-ink">O analista que os times universitários não têm.</h1>
        <p className="text-lg text-ink-2">
          K/D e ACS não dizem o que fazer. Um modelo calcula a chance de vitória do round a cada kill e, com ela, mede o impacto real de cada jogada.
          A partir disso, mostramos os momentos que decidiram a partida, quem cobre quem dentro do time e o papel que cada jogador realmente joga.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/times" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">Analisar meu time</Link>
          <Link href="/partidas" className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2">Ver partidas</Link>
          <Link href="/como-funciona" className="px-2 py-2 text-sm font-semibold text-accent hover:underline hover:underline-offset-4">Como funciona →</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Partidas (mapas)" value={num(index.matches.length)} sub="UNIVAVÁ e Rush Series" />
        <StatTile label="Rounds" value={num(rounds)} />
        <StatTile label="Times" value={num(index.team_list.length)} />
        <StatTile label="Jogadores" value={num(index.players.length)} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:bg-surface-2">
            <h2 className="font-semibold text-ink">{f.title} <span className="text-muted transition-transform group-hover:translate-x-0.5">→</span></h2>
            <p className="mt-1 text-sm text-ink-2">{f.text}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Times com mais mapas" subtitle="As amostras maiores, onde as comparações com a liga são mais confiáveis."
                 aside={<Link href="/times" className="text-sm text-accent hover:underline hover:underline-offset-4">Todos os times</Link>}>
          <table className="w-full">
            <thead><tr><Th>Time</Th><Th right>Mapas</Th><Th right>V · D</Th><Th right>Rounds vencidos</Th></tr></thead>
            <tbody>
              {topTeams.map((t) => (
                <tr key={t.slug} className="hover:bg-surface-2">
                  <Td><Link href={`/times/${t.slug}`} className="font-medium text-ink hover:underline hover:underline-offset-4">{t.name}</Link></Td>
                  <Td right>{t.maps}</Td>
                  <Td right className="whitespace-nowrap text-ink-2">{t.map_wins} · {t.maps - t.map_wins}</Td>
                  <Td right>{pct(t.round_win)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Partidas mais recentes"
                 aside={<Link href="/partidas" className="text-sm text-accent hover:underline hover:underline-offset-4">Todas as partidas</Link>}>
          <ul className="divide-y divide-line/50">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/partidas/${m.id}`} className="-mx-2 block rounded-md px-2 py-2 hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className={m.winner === "Red" ? "font-semibold text-ink" : "text-ink-2"}>{teamName(m.red)}</span>
                    <span className="tabular shrink-0 font-semibold text-ink">{m.score.Red} <span className="text-muted">–</span> {m.score.Blue}</span>
                    <span className={`text-right ${m.winner === "Blue" ? "font-semibold text-ink" : "text-ink-2"}`}>{teamName(m.blue)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{date(m.date)} · {competitionLabel(m.competition, m.stage)} · {m.map}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}

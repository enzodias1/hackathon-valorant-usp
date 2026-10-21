// Página de TESTE do minimapa (só em desenvolvimento; em produção dá 404).
// Uso: /dev/minimap?partida=<id>&round=<n>
import Link from "next/link";
import { notFound } from "next/navigation";
import Minimap from "@/components/Minimap";
import { getIndex, getMatch } from "@/lib/data";
import { date } from "@/lib/format";

const DEFAULT_MATCH = "02e4c729-6b8e-4341-bf35-6678ffad6dad"; // Ascent · FEI Whiteowls × IME Wolves Red

export default async function MinimapDevPage({
  searchParams,
}: {
  searchParams: Promise<{ partida?: string; round?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { partida, round } = await searchParams;
  const index = await getIndex();
  const id = partida && index.matches.some((m) => m.id === partida) ? partida : DEFAULT_MATCH;
  const match = await getMatch(id);
  const n = Math.min(Math.max(Number(round) || 1, 1), match.rounds.length);
  const r = match.rounds[n - 1];
  const teamName = (slug: string) => index.teams[slug]?.name ?? slug;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-lg font-semibold">Teste do minimapa</h1>

      <form className="flex flex-wrap gap-2 text-sm">
        <select name="partida" defaultValue={id} className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1">
          {index.matches.map((m) => (
            <option key={m.id} value={m.id}>
              {date(m.date)} · {m.map} · {teamName(m.red)} × {teamName(m.blue)}
            </option>
          ))}
        </select>
        <button className="rounded-md border border-line bg-surface-2 px-3 py-1 hover:bg-surface">Abrir</button>
      </form>

      <nav className="flex flex-wrap gap-1 text-sm" aria-label="Rounds">
        {match.rounds.map((x) => (
          <Link
            key={x.n}
            href={`?partida=${id}&round=${x.n}`}
            className={`tabular rounded px-2 py-0.5 ${x.n === n ? "bg-accent text-ink" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
          >
            {x.n}
          </Link>
        ))}
      </nav>

      <Minimap match={match} round={r} />
    </main>
  );
}

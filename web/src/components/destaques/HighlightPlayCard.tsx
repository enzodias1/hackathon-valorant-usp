// Uma jogada de alto impacto: quem fez, o que fez, quanto mudou a chance do time e o link para o replay.
import { clock, pp } from "@/lib/format";
import type { PlayHighlight } from "@/lib/highlights";
import { CardShell, chance, MatchLine, ReplayButton, teamColor } from "./parts";

export default function HighlightPlayCard({ item, rank }: { item: PlayHighlight; rank: number }) {
  const { actor } = item;
  return (
    <CardShell rank={rank} mapCode={item.match.mapCode}>
      <div className="flex items-center gap-3 pr-12">
        {actor.agentIcon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actor.agentIcon} alt={actor.agent} title={actor.agent} className="h-12 w-12 shrink-0 rounded" />
        )}
        <p className="min-w-0 leading-snug">
          <span className={`font-semibold ${teamColor(actor.color)}`}>{actor.name}</span>{" "}
          <span className="text-ink">{item.action}</span>
          <span className="block text-xs text-muted">{actor.agent} · round {item.round} · {clock(item.t)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-ink-2">
          Chance do time: <span className="tabular text-ink">{chance(item.wpBefore)} → {chance(item.wpAfter)}</span>
        </p>
        <p className="font-display tabular text-2xl leading-none text-good">{pp(item.wpa)}</p>
      </div>

      <MatchLine match={item.match} />
      <ReplayButton href={item.href} />
    </CardShell>
  );
}

// Uma virada: o round em que o vencedor chegou à menor chance de vitória e mesmo assim ganhou.
import { clock } from "@/lib/format";
import type { ComebackHighlight } from "@/lib/highlights";
import { CardShell, chance, MatchLine, ReplayButton, teamColor } from "./parts";

export default function ComebackCard({ item, rank }: { item: ComebackHighlight; rank: number }) {
  const { match, winner, scoreBefore } = item;
  return (
    <CardShell rank={rank} mapCode={match.mapCode}>
      <p className="label-caps pr-12 text-[11px] text-ink-2">
        Round {item.round} · placar antes{" "}
        <span className="tabular"><span className={teamColor("Red")}>{scoreBefore.Red}</span>–<span className={teamColor("Blue")}>{scoreBefore.Blue}</span></span>
      </p>

      <p className="pr-12 leading-snug">
        <span className={`font-semibold ${teamColor(winner)}`}>{match.teams[winner]}</span>{" "}
        <span className="text-ink">chegou a</span>{" "}
        <span className="font-display tabular text-2xl leading-none text-lime">{chance(item.minWp)}</span>{" "}
        <span className="text-ink">e venceu</span>
        <span className="block text-xs text-muted">
          menor chance aos {clock(item.t)}, com {item.aliveThen[0]} contra {item.aliveThen[1]} · resultado: {item.result}
        </span>
      </p>
      {item.story.length > 0 && <p className="pr-2 text-sm leading-relaxed text-ink-2">{item.story.join(" ")}</p>}

      <MatchLine match={match} winner={winner} />
      <ReplayButton href={item.href} />
    </CardShell>
  );
}

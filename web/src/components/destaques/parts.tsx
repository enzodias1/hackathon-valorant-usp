// Peças comuns aos cards da página "Destaques": moldura com o splash do mapa, linha da partida e botão do replay.
import Link from "next/link";
import { date, pct } from "@/lib/format";
import { mapSplash } from "@/lib/art";
import type { MatchInfo } from "@/lib/highlights";

/** Chance de vitória com uma casa decimal perto dos extremos (0,4% e 99,6% em vez de 0% e 100%); abaixo de 0,1%, "menos de 0,1%". */
export const chance = (x: number) => {
  if (x > 0 && x < 0.001) return "menos de 0,1%";
  if (x > 0.999 && x < 1) return "mais de 99,9%";
  return pct(x, x < 0.01 || (x > 0.99 && x < 1) ? 1 : 0);
};

export const teamColor = (c: "Red" | "Blue") => (c === "Red" ? "text-team-red" : "text-team-blue");

export function CardShell({ rank, mapCode, children }: { rank: number; mapCode: string; children: React.ReactNode }) {
  const splash = mapSplash(mapCode);
  return (
    <article className="relative isolate flex h-full flex-col gap-3 overflow-hidden rounded-md bg-surface p-4 sm:p-5">
      {splash && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={splash} alt="" aria-hidden loading="lazy"
               className="pointer-events-none absolute inset-y-0 right-0 -z-20 h-full w-2/3 object-cover opacity-25 mix-blend-luminosity" />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-surface from-40% to-surface/60" />
        </>
      )}
      <span className="font-display absolute right-4 top-3 text-3xl leading-none text-lime/80">#{rank}</span>
      {children}
    </article>
  );
}

/** "Time A × Time B" com as cores dos times, e mapa · data · competição embaixo. */
export function MatchLine({ match, winner }: { match: MatchInfo; winner?: "Red" | "Blue" }) {
  return (
    <div className="text-sm">
      <p className="font-semibold">
        <span className={teamColor("Red")}>{match.teams.Red}</span>
        {winner === "Red" && <span className="sr-only"> (venceu o round)</span>}
        <span className="text-muted"> × </span>
        <span className={teamColor("Blue")}>{match.teams.Blue}</span>
        {winner === "Blue" && <span className="sr-only"> (venceu o round)</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted">{match.map} · {date(match.date)} · {match.competition}</p>
    </div>
  );
}

export function ReplayButton({ href }: { href: string }) {
  return (
    <Link href={href}
          className="label-caps mt-auto inline-flex w-fit items-center gap-2 bg-lime px-4 py-2.5 text-[11px] text-bg transition-opacity [clip-path:polygon(0_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%)] hover:opacity-90">
      ▶ Ver no replay
    </Link>
  );
}

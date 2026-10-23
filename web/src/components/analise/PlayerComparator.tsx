"use client";
// Comparador jogador × jogador: lê os JSONs dos dois no navegador (seleção na URL: ?a=&b=). Mostra o frente a frente (duelos
// diretos, ou a parceria quando jogam no mesmo time), as estatísticas lado a lado e os agentes mais jogados.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Player, PlayerSummary } from "@/lib/types";
import { betterThan, nick, num, pct, pp } from "@/lib/format";

export type PlayerOption = PlayerSummary & { team_name: string };

// exemplo ao abrir sem escolha: a dupla de rivais com mais duelos diretos na base (43; greiN 24 × 19 Dante)

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Picker({ label, value, options, other, onPick }: {
  label: string; value: string; options: PlayerOption[]; other: string; onPick: (puuid: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.puuid === value);
  // todos os jogadores, agrupados por time (times em ordem alfabética; no time, quem jogou mais rounds primeiro); digitar filtra
  const groups = useMemo(() => {
    const words = fold(q).trim().split(/\s+/).filter(Boolean);
    const byTeam = new Map<string, PlayerOption[]>();
    for (const o of options) {
      if (o.puuid === other || !words.every((w) => fold(`${o.name} ${o.team_name}`).includes(w))) continue;
      byTeam.set(o.team_name, [...(byTeam.get(o.team_name) ?? []), o]);
    }
    return [...byTeam.entries()].sort((x, y) => x[0].localeCompare(y[0], "pt-BR"))
      .map(([team, list]) => [team, list.sort((x, y) => y.rounds - x.rounds)] as const);
  }, [q, options, other]);
  return (
    <label className="relative flex flex-1 flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <input value={open ? q : cur ? `${nick(cur.name)} · ${cur.team_name}` : q} placeholder="Escolha na lista ou digite o nick ou o time…"
             onFocus={() => { setOpen(true); setQ(""); }} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => setQ(e.target.value)}
             className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface-2 pb-1 shadow-2xl">
          {groups.length ? groups.map(([team, list]) => (
            <li key={team}>
              <p className="label-caps sticky top-0 bg-surface-2 px-3 pb-1 pt-2 text-[10px] text-muted">{team}</p>
              <ul>
                {list.map((o) => (
                  <li key={o.puuid}>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(o.puuid); setOpen(false); }}
                            className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left hover:bg-surface ${o.puuid === value ? "bg-surface" : ""}`}>
                      <span className="truncate text-sm text-ink">{nick(o.name)}</span>
                      <span className="shrink-0 text-xs text-muted">{o.rounds} rounds{o.agent_role ? ` · ${o.agent_role}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          )) : <li className="px-3 py-2 text-sm text-ink-2">Nenhum jogador encontrado.</li>}
        </ul>
      )}
    </label>
  );
}

type Row = { label: string; a: number | null; b: number | null; fmt: (x: number) => string; pa?: number | null; pb?: number | null;
  /** posição na liga de cada um (até o 5º aparece no lugar do percentil) */
  ra?: number | null; rb?: number | null; hint?: string };

function StatRow({ r }: { r: Row }) {
  const better = r.a != null && r.b != null && r.a !== r.b ? (r.a > r.b ? "a" : "b") : null;
  const cell = (v: number | null, p: number | null | undefined, rank: number | null | undefined, side: "a" | "b") => (
    <div className={side === "a" ? "text-right" : "text-left"}>
      <span className={`tabular text-base ${better === side ? "font-semibold text-lime" : "text-ink"}`}>{v == null ? "—" : r.fmt(v)}</span>
      {p != null && <span className="block text-[11px] text-muted">{betterThan(p, "", rank)}</span>}
    </div>
  );
  // barras espelhadas pela posição na liga (0–100), quando os dois têm 60+ rounds
  const bar = (p: number | null | undefined, side: "a" | "b") => (
    <div className={`flex h-2 flex-1 ${side === "a" ? "justify-end" : ""}`}>
      {p != null && <div className={`h-full rounded-sm ${better === side ? "bg-lime" : "bg-accent/70"}`} style={{ width: `${p}%` }} />}
    </div>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_8.5rem_minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 border-b border-line/50 py-2.5"
         title={r.hint}>
      {cell(r.a, r.pa, r.ra, "a")}
      {bar(r.pa, "a")}
      <span className="text-center text-xs uppercase tracking-wide text-ink-2">{r.label}</span>
      {bar(r.pb, "b")}
      {cell(r.b, r.pb, r.rb, "b")}
    </div>
  );
}

function Head({ p, side }: { p: Player; side: "a" | "b" }) {
  const icon = p.agents[0]?.icon;
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-line bg-surface p-4 ${side === "b" ? "flex-row-reverse text-right" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon && <img src={icon} alt={p.agents[0].agent} className="h-14 w-14 shrink-0 rounded-lg" />}
      <div className="min-w-0">
        <Link href={`/jogadores/${p.puuid}`} className="font-display block truncate text-2xl uppercase tracking-wide text-ink hover:text-lime">{nick(p.name)}</Link>
        <p className="truncate text-sm text-ink-2">{p.team_name}{p.role.agent_role ? ` · ${p.role.agent_role}` : ""}</p>
        <p className="text-xs text-muted">{p.sample.rounds} rounds · {p.sample.maps} mapas</p>
      </div>
    </div>
  );
}

export default function PlayerComparator({ players }: { players: PlayerOption[] }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [data, setData] = useState<{ a?: Player; b?: Player }>({});

  // começa vazio, como o comparador de times; a e b na URL abrem uma comparação direto (ex.: o atalho da apresentação)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setA(q.get("a") ?? "");
    setB(q.get("b") ?? "");
  }, []);

  useEffect(() => {
    if (!a && !b) return;
    const q = new URLSearchParams();
    if (a) q.set("a", a);
    if (b) q.set("b", b);
    window.history.replaceState(null, "", `?${q.toString()}`);
    const load = (id: string) => (id ? fetch(`/data/players/${encodeURIComponent(id)}.json`).then((r) => r.json() as Promise<Player>) : Promise.resolve(undefined));
    let alive = true;
    Promise.all([load(a), load(b)]).then(([pa, pb]) => alive && setData({ a: pa, b: pb }));
    return () => { alive = false; };
  }, [a, b]);

  const A = data.a?.puuid === a ? data.a : undefined, B = data.b?.puuid === b ? data.b : undefined;
  const sameTeam = !!A && !!B && (A.team === B.team || A.teams.some((t) => B.teams.some((u) => u.slug === t.slug)));
  const duel = A && B ? A.duels.opponents.find((o) => o.puuid === B.puuid) : undefined;
  const partner = A && B ? A.partners.find((o) => o.puuid === B.puuid) : undefined;

  const rate = (k: number, n: number) => (n > 0 ? k / n : null);
  const rows: Row[] = A && B ? [
    { label: "Impacto / round", a: A.impact.wpa_per_round, b: B.impact.wpa_per_round, fmt: (x) => pp(x), pa: A.percentiles?.wpa_per_round, pb: B.percentiles?.wpa_per_round, ra: A.ranks?.wpa_per_round, rb: B.ranks?.wpa_per_round,
      hint: "Quanto o jogador muda, em média, a chance de vitória do round" },
    { label: "K/D", a: A.summary.kd, b: B.summary.kd, fmt: (x) => num(x, 2), pa: A.percentiles?.kd, pb: B.percentiles?.kd, ra: A.ranks?.kd, rb: B.ranks?.kd },
    { label: "ACS", a: A.summary.acs, b: B.summary.acs, fmt: (x) => num(x), pa: A.percentiles?.acs, pb: B.percentiles?.acs, ra: A.ranks?.acs, rb: B.ranks?.acs },
    { label: "ADR", a: A.summary.adr, b: B.summary.adr, fmt: (x) => num(x), pa: A.percentiles?.adr, pb: B.percentiles?.adr, ra: A.ranks?.adr, rb: B.ranks?.adr },
    { label: "KAST", a: A.summary.kast, b: B.summary.kast, fmt: (x) => pct(x), pa: A.percentiles?.kast, pb: B.percentiles?.kast, ra: A.ranks?.kast, rb: B.ranks?.kast },
    { label: "% headshot", a: A.summary.hs_pct, b: B.summary.hs_pct, fmt: (x) => pct(x), pa: A.percentiles?.hs_pct, pb: B.percentiles?.hs_pct, ra: A.ranks?.hs_pct, rb: B.ranks?.hs_pct },
    { label: "Kills / round", a: A.summary.kpr, b: B.summary.kpr, fmt: (x) => num(x, 2), pa: A.percentiles?.kpr, pb: B.percentiles?.kpr, ra: A.ranks?.kpr, rb: B.ranks?.kpr },
    { label: "Duelos vencidos", a: A.duels.win_rate, b: B.duels.win_rate, fmt: (x) => pct(x), hint: "Contra todos os adversários da base" },
    { label: "1º duelo vencido", a: rate(A.summary.fk, A.summary.fk + A.summary.fd), b: rate(B.summary.fk, B.summary.fk + B.summary.fd), fmt: (x) => pct(x),
      hint: "Dos rounds em que disputou o primeiro duelo" },
    { label: "Clutches vencidos", a: rate(A.summary.clutch_won, A.summary.clutch_att), b: rate(B.summary.clutch_won, B.summary.clutch_att), fmt: (x) => pct(x),
      hint: "Situações em que ficou sozinho contra um ou mais" },
  ] : [];

  return (
    <div className="space-y-6">
      <div data-print-hide className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Picker label="Jogador A" value={a} options={players} other={b} onPick={setA} />
        <span className="font-display hidden pb-1.5 text-2xl text-muted sm:block" aria-hidden>×</span>
        <Picker label="Jogador B" value={b} options={players} other={a} onPick={setB} />
      </div>

      {!A || !B ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-ink-2">{a && b ? "Carregando os dois jogadores…" : "Escolha os dois jogadores para comparar."}</p>
      ) : (
        <>
          <div data-pdf-section="Os dois jogadores" data-pdf-title={`${A.name.split("#")[0]} × ${B.name.split("#")[0]}`} className="grid gap-3 md:grid-cols-2">
            <Head p={A} side="a" />
            <Head p={B} side="b" />
          </div>

          <section data-pdf-section={sameTeam ? "Jogando juntos" : "Frente a frente"} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-2xl tracking-wide text-ink">{sameTeam ? "Jogando juntos" : "Frente a frente"}</h2>
            {sameTeam ? (
              partner ? (
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <p className="text-ink-2"><b className="font-display block text-3xl text-ink">{num(partner.rounds_together)}</b>rounds juntos</p>
                  <p className="text-ink-2"><b className="font-display block text-3xl text-lime">{num(partner.they_traded_you)}×</b>{nick(B.name)} vingou {nick(A.name)}
                    <span className="block text-xs text-muted">de {num(partner.your_deaths_with_them_alive)} mortes com {nick(B.name)} vivo</span></p>
                  <p className="text-ink-2"><b className="font-display block text-3xl text-lime">{num(partner.you_traded_them)}×</b>{nick(A.name)} vingou {nick(B.name)}</p>
                </div>
              ) : <p className="mt-2 text-sm text-ink-2">Os dois jogaram pelo mesmo time, mas com poucos rounds juntos para medir a parceria.</p>
            ) : duel ? (
              <div className="mt-4">
                <div className="flex items-end justify-between text-sm">
                  <span className="text-ink"><b className="font-display text-4xl text-team-red">{duel.kills}</b> duelos vencidos por {nick(A.name)}</span>
                  <span className="text-right text-ink">{nick(B.name)} venceu <b className="font-display text-4xl text-team-blue">{duel.deaths}</b></span>
                </div>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full" role="img" aria-label={`${duel.kills} a ${duel.deaths}`}>
                  <div className="bg-team-red" style={{ width: `${(duel.kills / (duel.kills + duel.deaths)) * 100}%` }} />
                  <div className="flex-1 bg-team-blue" />
                </div>
                <p className="mt-2 text-xs text-muted">Duelo: um eliminou o outro, em todas as partidas da base ({duel.kills + duel.deaths} no total).</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Os dois se enfrentaram menos de 3 vezes na base: pouco para um placar de duelos.</p>
            )}
          </section>

          <section data-pdf-section="Lado a lado" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-2xl tracking-wide text-ink">Lado a lado</h2>
            <div className="mt-2 grid grid-cols-2 text-sm">
              <span className="font-semibold text-ink">{nick(A.name)}</span>
              <span className="text-right font-semibold text-ink">{nick(B.name)}</span>
            </div>
            <div className="mt-1 overflow-x-auto"><div className="min-w-[640px]">{rows.map((r) => <StatRow key={r.label} r={r} />)}</div></div>
            <p className="mt-3 text-xs text-muted">
              Em todas as partidas de cada um. Em amarelo, o melhor da linha. “Melhor que X%” compara com os jogadores da liga com 60 rounds ou mais (do 1º ao 10º, aparece a posição),
              e a barra vai do pior ao melhor da liga.
            </p>
          </section>

          <section data-pdf-section="Agentes mais jogados" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-2xl tracking-wide text-ink">Agentes mais jogados</h2>
            {/* o nome em cima de cada lista: no PDF (e no celular) as duas não ficam lado a lado como na tela */}
            <div className="mt-3 grid gap-6 md:grid-cols-2">
              {[A, B].map((p) => (
                <div key={p.puuid} className="min-w-0">
                  <p className="mb-2 text-sm font-semibold text-ink">{nick(p.name)}</p>
                  <ul className="space-y-2">
                    {p.agents.slice(0, 3).map((g) => (
                      <li key={g.agent} className="flex items-center gap-3 text-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {g.icon && <img src={g.icon} alt="" className="h-8 w-8 rounded" />}
                        <span className="flex-1 text-ink">{g.agent} <span className="text-xs text-muted">{g.rounds} rounds</span></span>
                        <span className="tabular text-xs text-ink-2">K/D {num(g.kd, 2)}</span>
                        <span className={`tabular whitespace-nowrap text-right text-xs ${g.wpa_per_round >= 0 ? "text-good" : "text-bad"}`}>{pp(g.wpa_per_round)} por round</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

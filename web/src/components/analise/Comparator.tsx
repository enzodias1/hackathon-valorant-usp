"use client";
// Comparador pré-jogo: meu time × adversário. Lê os JSONs dos dois times no navegador (seleção fica na URL: ?a=&b=).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Team, TeamSummary } from "@/lib/types";
import { date, nick, pct, pp } from "@/lib/format";
import { Td, Th } from "./ui";
import HeadToHead from "./HeadToHead";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Chance de vencer o mapa (primeiro a 13; no 12–12, prorrogação por 2 rounds de vantagem) com chance p por round. */
function mapWinProb(p: number) {
  const q = 1 - p;
  const binom = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
  let win = 0;
  for (let b = 0; b <= 11; b++) win += binom(12 + b, b) * p ** 13 * q ** b;
  const tie = binom(24, 12) * p ** 12 * q ** 12;
  return win + tie * (p * p) / (p * p + q * q);
}

const STYLE_KEYS = ["atk_win", "def_win", "pistol_win", "fb_rate", "postplant_win", "retake_win", "traded_death_rate", "isolated_death_rate", "throw_rate"];

export default function Comparator({ teams }: { teams: TeamSummary[] }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [data, setData] = useState<{ a?: Team; b?: Team }>({});
  const sorted = useMemo(() => [...teams].sort((x, y) => x.name.localeCompare(y.name, "pt-BR")), [teams]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setA(q.get("a") ?? "");
    setB(q.get("b") ?? "");
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (a) q.set("a", a);
    if (b) q.set("b", b);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
    const load = (slug: string) => (slug ? fetch(`/data/teams/${slug}.json`).then((r) => r.json() as Promise<Team>) : Promise.resolve(undefined));
    let alive = true;
    Promise.all([load(a), load(b)]).then(([ta, tb]) => alive && setData({ a: ta, b: tb }));
    return () => { alive = false; };
  }, [a, b]);

  const select = (value: string, set: (v: string) => void, label: string, other: string) => (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none">
        <option value="">Escolha um time…</option>
        {sorted.map((t) => <option key={t.slug} value={t.slug} disabled={t.slug === other}>{t.name} ({t.maps} mapas)</option>)}
      </select>
    </label>
  );

  const A = data.a, B = data.b;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {select(a, setA, "Time", b)}
        <span className="hidden pb-2 text-muted sm:block">×</span>
        {select(b, setB, "Adversário", a)}
      </div>
      {A && B && A.slug === a && B.slug === b ? <Comparison A={A} B={B} /> : (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-ink-2">Escolha os dois times para comparar.</p>
      )}
    </div>
  );
}

function Comparison({ A, B }: { A: Team; B: Team }) {
  const pRound = sigmoid(A.strength.theta - B.strength.theta);
  const pMap = mapWinProb(pRound);
  const h2h = A.matches.filter((m) => m.opponent === B.slug);
  const fav = pMap >= 0.5 ? A : B;
  const unreliable = !A.strength.reliable || !B.strength.reliable;

  // mapas: rendimento de cada time por mapa; sugestão onde os dois têm ≥ 2 mapas
  const mapNames = [...new Set([...A.maps.map((m) => m.map), ...B.maps.map((m) => m.map)])];
  const rows = mapNames.map((name) => {
    const ma = A.maps.find((m) => m.map === name), mb = B.maps.find((m) => m.map === name);
    const comparable = (ma?.maps ?? 0) >= 2 && (mb?.maps ?? 0) >= 2;
    return { name, ma, mb, edge: comparable ? ma!.round_win - mb!.round_win : null };
  }).sort((x, y) => (y.ma?.maps ?? 0) + (y.mb?.maps ?? 0) - (x.ma?.maps ?? 0) - (x.mb?.maps ?? 0));
  const comparable = rows.filter((r) => r.edge != null).sort((x, y) => y.edge! - x.edge!);
  const pick = comparable[0]?.edge != null && comparable[0].edge > 0 ? comparable[0] : null;
  const ban = comparable.at(-1)?.edge != null && comparable.at(-1)!.edge! < 0 ? comparable.at(-1)! : null;

  const metric = (t: Team, k: string) => t.metrics.find((m) => m.key === k);
  const pistolEco = (t: Team) => t.economy.find((e) => e.context === "perdeu o pistol");
  const ecoB = pistolEco(B);
  const ecoShare = ecoB && ecoB.n ? (ecoB.decisions.Economizar?.n ?? 0) / ecoB.n : null;
  const core = (t: Team) => t.roster.filter((p) => p.core).sort((x, y) => y.wpa_per_round - x.wpa_per_round);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted">Quem é favorito</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{fav.name} <span className="text-ink-2">vence {pct(fav === A ? pMap : 1 - pMap)} dos mapas</span></p>
          <p className="mt-1 text-sm text-ink-2">
            Pela força dos times ({A.name}: {A.strength.rank}º · {B.name}: {B.strength.rank}º de {A.strength.of}), {A.name} vence {pct(pRound)} dos rounds contra {B.name} com economia parecida.
            Isso vira {pct(pMap)} de chance de vencer um mapa.
          </p>
          {unreliable && <p className="mt-2 text-xs text-warn">! Um dos times tem menos de 100 rounds: estimativa imprecisa.</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Confrontos diretos</p>
          {h2h.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {h2h.map((m) => (
                <li key={m.id}><Link href={`/partidas/${m.id}`} className="hover:underline">
                  <span className={m.won ? "text-good" : "text-bad"}>{m.won ? "V" : "D"}</span> {m.score_for}–{m.score_against} · {m.map} · <span className="text-muted">{date(m.date)}</span>
                </Link></li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-2">Nunca se enfrentaram nestes campeonatos.</p>}
        </div>
      </section>

      {h2h.length > 0 && <HeadToHead A={A} B={B} ids={h2h.map((m) => m.id)} />}

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Mapas</h2>
        <p className="mt-1 text-sm text-ink-2">Rounds vencidos em cada mapa por cada time (mapas jogados entre parênteses). A sugestão só considera mapas em que os dois jogaram pelo menos 2 vezes.</p>
        {(pick || ban) && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {pick && <span className="rounded-lg bg-surface-2 px-3 py-2"><span className="text-good">▲ Escolher:</span> <b className="text-ink">{pick.name}</b> <span className="text-ink-2">({pp(pick.edge! * 100, 0)} em rounds vencidos)</span></span>}
            {ban && <span className="rounded-lg bg-surface-2 px-3 py-2"><span className="text-bad">▼ Vetar:</span> <b className="text-ink">{ban.name}</b> <span className="text-ink-2">({pp(ban.edge! * 100, 0)})</span></span>}
          </div>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead><tr><Th>Mapa</Th><Th right>{A.tag}</Th><Th right>{B.tag}</Th><Th right>Diferença</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <Td>{r.name}</Td>
                  <Td right>{r.ma ? <>{pct(r.ma.round_win)} <span className="text-muted">({r.ma.maps})</span></> : <span className="text-muted">—</span>}</Td>
                  <Td right>{r.mb ? <>{pct(r.mb.round_win)} <span className="text-muted">({r.mb.maps})</span></> : <span className="text-muted">—</span>}</Td>
                  <Td right>{r.edge == null ? <span className="text-muted">pouca amostra</span> : <span className={r.edge > 0 ? "text-good" : r.edge < 0 ? "text-bad" : "text-ink-2"}>{pp(r.edge * 100, 0)}</span>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Estilo lado a lado</h2>
        <p className="mt-1 text-sm text-ink-2">▲/▼: diferença em relação à liga confirmada estatisticamente.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr><Th>Métrica</Th><Th right>{A.tag}</Th><Th right>{B.tag}</Th><Th right>Liga</Th></tr></thead>
            <tbody>
              {STYLE_KEYS.map((k) => {
                const ma = metric(A, k), mb = metric(B, k);
                if (!ma || !mb) return null;
                const cell = (m: typeof ma) => <>{pct(m.value)} {m.significant && <span className={m.good ? "text-good" : "text-bad"}>{m.good ? "▲" : "▼"}</span>}</>;
                return (
                  <tr key={k}><Td>{ma.label}</Td><Td right>{cell(ma)}</Td><Td right>{cell(mb)}</Td><Td right className="text-muted">{pct(ma.league)}</Td></tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink">O que esperar de {B.name}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ecoShare != null && ecoB!.n >= 5 && (
              <li className="rounded-lg bg-surface-2 p-3 text-ink">
                💰 Depois de perder o pistol, economizou em {ecoB!.decisions.Economizar?.n ?? 0} de {ecoB!.n} vezes
                {ecoShare >= 0.7 ? ": espere eco no round 2 e no 14 (dá para jogar pela vantagem de armas, sem se expor)." : ecoShare <= 0.3 ? ": costuma forçar no round 2 e no 14, então não subestime o round seguinte ao pistol." : "."}
              </li>
            )}
            {[...B.insights.weaknesses, ...B.insights.attention].slice(0, 4).map((i) => (
              <li key={i.key} className="rounded-lg bg-surface-2 p-3 text-ink"><span className="text-bad">✕</span> {i.text}</li>
            ))}
            {[...B.insights.strengths].slice(0, 3).map((i) => (
              <li key={i.key} className="rounded-lg bg-surface-2 p-3 text-ink"><span className="text-good">✓</span> {i.text}</li>
            ))}
            {!B.insights.weaknesses.length && !B.insights.attention.length && !B.insights.strengths.length && (
              <li className="text-ink-2">Nenhuma diferença confirmada em relação à liga.</li>
            )}
          </ul>
          <Link href={`/times/${B.slug}`} className="mt-3 inline-block text-sm text-accent hover:underline">Página completa de {B.name} →</Link>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Jogadores-chave</h2>
          <p className="mt-1 text-sm text-ink-2">Titulares ordenados por impacto por round.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[A, B].map((t) => (
              <div key={t.slug}>
                <h3 className="mb-1 text-sm font-medium text-ink">{t.name}</h3>
                <ul className="space-y-1 text-sm">
                  {core(t).map((p) => (
                    <li key={p.puuid} className="flex justify-between gap-2">
                      <Link href={`/jogadores/${p.puuid}`} className="truncate text-ink hover:underline">{nick(p.name)} <span className="text-xs text-muted">{p.behavior_role ?? p.agent_role ?? ""}</span></Link>
                      <span className={`tabular shrink-0 ${p.wpa_per_round >= 0 ? "text-good" : "text-bad"}`}>{pp(p.wpa_per_round)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Impacto: quanto o jogador muda, em média, a chance de vitória do round (pontos percentuais).</p>
        </section>
      </div>
    </div>
  );
}

"use client";
// Grafo de sinergia: nós = titulares; aresta = dupla. Espessura = trades da dupla (um vingou a morte do outro);
// intensidade = taxa de trade da dupla vs. liga. Hover destaca a dupla/jogador e mostra o detalhe.
import { useState } from "react";
import type { Team } from "@/lib/types";
import { nick, pct } from "@/lib/format";

const W = 520, H = 440, R = 140, CX = W / 2, CY = H / 2 + 4;

export default function SynergyGraph({ synergy }: { synergy: Team["synergy"] }) {
  const [hover, setHover] = useState<{ kind: "edge"; i: number } | { kind: "node"; id: string } | null>(null);
  const nodes = synergy.nodes;
  if (nodes.length < 2) return <p className="text-sm text-ink-2">Elenco com poucos rounds juntos para montar o grafo.</p>;

  const pos = Object.fromEntries(nodes.map((n, i) => {
    const a = -Math.PI / 2 + (i / nodes.length) * 2 * Math.PI;
    return [n.puuid, { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }];
  }));
  const edges = synergy.edges.map((e, i) => ({ ...e, i, trades: e.b_traded_a + e.a_traded_b }));
  // escalas min–max dentro do time: o que importa é comparar as duplas entre si
  const tr = edges.map((e) => e.trades), rates = edges.map((e) => e.trade_rate ?? 0);
  const [tMin, tMax] = [Math.min(...tr), Math.max(...tr)], [rMin, rMax] = [Math.min(...rates), Math.max(...rates)];
  const norm = (x: number, lo: number, hi: number) => (hi > lo ? (x - lo) / (hi - lo) : 0.5);
  const league = synergy.league_pair_trade_rate;
  const name = (id: string) => nick(nodes.find((n) => n.puuid === id)?.name);

  const active = (e: (typeof edges)[number]) =>
    !hover || (hover.kind === "edge" ? hover.i === e.i : e.a === hover.id || e.b === hover.id);

  const detail = hover?.kind === "edge" ? edges[hover.i] : null;
  const nodeEdges = hover?.kind === "node" ? edges.filter((e) => e.a === hover.id || e.b === hover.id) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[560px]" role="img" aria-label="Grafo de sinergia do time: espessura = trades entre a dupla">
        {edges.map((e) => {
          const p = pos[e.a], q = pos[e.b];
          const rel = norm(e.trade_rate ?? 0, rMin, rMax);
          return (
            <g key={e.i} onMouseEnter={() => setHover({ kind: "edge", i: e.i })} onMouseLeave={() => setHover(null)} className="cursor-pointer">
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth={18} />
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} strokeLinecap="round"
                    stroke="var(--accent)" strokeOpacity={active(e) ? (hover ? 0.5 : 0.3) + (hover ? 0.5 : 0.7) * rel : 0.08}
                    strokeWidth={3 + norm(e.trades, tMin, tMax) * 11} />
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = pos[n.puuid];
          const dim = hover && !(hover.kind === "node" ? hover.id === n.puuid : [edges[hover.i].a, edges[hover.i].b].includes(n.puuid));
          const below = p.y > CY;
          return (
            <g key={n.puuid} onMouseEnter={() => setHover({ kind: "node", id: n.puuid })} onMouseLeave={() => setHover(null)}
               className="cursor-pointer" opacity={dim ? 0.35 : 1}>
              <circle cx={p.x} cy={p.y} r={22} fill="var(--surface-2)" stroke="var(--ink-2)" strokeWidth={1.5} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill="var(--ink)">{nick(n.name).slice(0, 3).toUpperCase()}</text>
              <text x={p.x} y={below ? p.y + 40 : p.y - 44} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)">{nick(n.name)}</text>
              <text x={p.x} y={below ? p.y + 55 : p.y - 30} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
                {n.agent_role ?? ""}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="text-sm">
        {detail ? (
          <div className="space-y-2">
            <p className="font-medium text-ink">{name(detail.a)} + {name(detail.b)}</p>
            <p className="text-ink-2">{detail.rounds_together} rounds juntos</p>
            <p className="text-ink">{name(detail.b)} vingou {name(detail.a)} <b>{detail.b_traded_a}×</b> <span className="text-muted">(de {detail.a_deaths_b_alive} mortes com {name(detail.b)} vivo)</span></p>
            <p className="text-ink">{name(detail.a)} vingou {name(detail.b)} <b>{detail.a_traded_b}×</b> <span className="text-muted">(de {detail.b_deaths_a_alive} mortes com {name(detail.a)} vivo)</span></p>
            <p className="text-ink">Assistências entre os dois: <b>{detail.assists}</b></p>
            <p className="text-ink-2">Taxa de trade da dupla: <span className="text-ink">{pct(detail.trade_rate)}</span> (média de duplas da liga: {pct(league)})</p>
          </div>
        ) : hover?.kind === "node" ? (
          <div className="space-y-2">
            <p className="font-medium text-ink">{name(hover.id)}</p>
            {nodeEdges.sort((x, y) => y.trades - x.trades).map((e) => {
              const other = e.a === hover.id ? e.b : e.a;
              const mine = e.a === hover.id ? e.a_traded_b : e.b_traded_a;
              const theirs = e.a === hover.id ? e.b_traded_a : e.a_traded_b;
              return <p key={e.i} className="text-ink-2">com <span className="text-ink">{name(other)}</span>: vingou {mine}×, foi vingado {theirs}×</p>;
            })}
          </div>
        ) : (
          <div className="space-y-2 text-ink-2">
            <p><b className="text-ink">Como ler:</b> cada linha é uma dupla. Quanto mais grossa, mais vezes um vingou a morte do outro (trade em até 5 s). Quanto mais forte a cor, maior a taxa de trade da dupla. As escalas comparam as duplas deste time entre si.</p>
            <p>Passe o mouse numa linha ou num jogador para ver os números.</p>
            <p className="text-muted">Média de duplas na liga: {pct(league)} das mortes vingadas pelo parceiro.</p>
          </div>
        )}
      </div>
    </div>
  );
}

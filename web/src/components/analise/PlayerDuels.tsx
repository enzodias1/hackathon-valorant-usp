// Página do jogador: duelos (contra quem e contra quais agentes) e quando morre no round.
// Pedidos das entrevistas com 21 jogadores e jogadoras dos times da UFG no UNIVAVÁ: histórico de duelos e "você morre muito aos X".
import { clock, nick, pct } from "@/lib/format";
import type { DeathTiming, PlayerDuels } from "@/lib/types";
import { PlayerLink } from "./ui";

const ROLE_PLURAL: Record<string, string> = { Duelista: "duelistas", Iniciador: "iniciadores", Controlador: "controladores", Sentinela: "sentinelas" };

/** Quem é a referência da comparação: a liga na mesma função (ou na mesma mistura de funções que o jogador joga). */
export function referenceLabel(t: DeathTiming) {
  const roles = Object.keys(t.roles);
  return roles.length === 1 ? `${ROLE_PLURAL[roles[0]] ?? roles[0]} da liga` : "liga, nas mesmas funções";
}

const secs = (s: number) => clock(s * 1000);

/** Barra dividida: parte do jogador (eliminações) e o resto (mortes). */
function SplitBar({ win }: { win: number }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div className="h-full bg-accent" style={{ width: `${win * 100}%` }} />
    </div>
  );
}

export function DuelsPanel({ duels }: { duels: PlayerDuels }) {
  const rate = duels.win_rate;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="label-caps mb-2 text-[11px] text-muted">Confrontos diretos</h3>
        {duels.opponents.length ? (
          <ul className="divide-y divide-line/50">
            {duels.opponents.map((o) => (
              <li key={o.puuid} className="grid grid-cols-[minmax(0,1fr)_4.5rem_6rem] items-center gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <PlayerLink puuid={o.puuid} name={nick(o.name)} />
                  {o.team_name && <span className="ml-2 text-xs text-muted">{o.team_name}</span>}
                </span>
                <span className="tabular text-right">
                  <b className="text-ink">{o.kills}</b> <span className="text-muted">×</span> <span className="text-ink-2">{o.deaths}</span>
                </span>
                <SplitBar win={o.kills / (o.kills + o.deaths)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">Nenhum adversário com 3 ou mais duelos.</p>
        )}
        <p className="mt-2 text-xs text-muted">
          Eliminações × mortes contra cada adversário, somando todas as partidas. No total: {duels.kills} × {duels.deaths}
          {rate != null && <> (vence {pct(rate)} dos duelos)</>}.
        </p>
      </div>

      <div>
        <h3 className="label-caps mb-2 text-[11px] text-muted">Por agente adversário</h3>
        {duels.by_agent.length ? (
          <ul className="divide-y divide-line/50">
            {duels.by_agent.map((a) => (
              <li key={a.agent} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_4.5rem] items-center gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.icon && <img src={a.icon} alt="" className="h-6 w-6 shrink-0 rounded" />}
                  <span className="truncate text-ink">{a.agent}</span>
                </span>
                <span className="relative">
                  <SplitBar win={a.win ?? 0} />
                  {rate != null && <span aria-hidden className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${rate * 100}%` }} title="média do jogador" />}
                </span>
                <span className="tabular text-right text-xs">
                  <span className="text-ink">{pct(a.win)}</span>
                  <span className="block text-muted">{a.kills} × {a.deaths}</span>
                  {a.significant && (
                    <span className={`block font-semibold ${a.good ? "text-good" : "text-bad"}`}>{a.good ? "▲ confirmado" : "▼ confirmado"}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">Nenhum agente adversário com 10 ou mais duelos.</p>
        )}
        <p className="mt-2 text-xs text-muted">
          Duelos vencidos contra cada agente (com 10+ duelos). O traço é a média do próprio jogador; “confirmado” só quando a diferença
          passa no teste estatístico, já descontados os falsos positivos.
        </p>
      </div>
    </div>
  );
}

export function DeathTimingPanel({ timing }: { timing: DeathTiming }) {
  const ref = referenceLabel(timing);
  const top = Math.max(...timing.bins.map((b) => Math.max(b.share, b.league)), 0.01);
  const label = (b: DeathTiming["bins"][number]) => (b.to >= 1000 ? `${secs(b.from)}+` : `${secs(b.from)}–${secs(b.to)}`);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-2 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted">Metade das mortes até</div>
          <div className="font-display mt-1 text-3xl text-ink">{secs(timing.median)}</div>
          <div className="text-xs text-ink-2">{ref}: {secs(timing.league_median)}</div>
        </div>
        <div className="rounded-lg bg-surface-2 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted">Mortes nos primeiros {timing.early_s} s</div>
          <div className="font-display mt-1 text-3xl text-ink">{pct(timing.early)}</div>
          <div className="text-xs text-ink-2">{ref}: {pct(timing.league_early)}</div>
        </div>
      </div>

      <div>
        <div className="flex h-44 items-end gap-2" role="img"
             aria-label={`Distribuição das mortes ao longo do round: ${timing.bins.map((b) => `${label(b)} ${pct(b.share)}`).join(", ")}`}>
          {timing.bins.map((b) => (
            <div key={b.from} className="relative flex h-full flex-1 flex-col justify-end" title={`${label(b)}: ${pct(b.share)} das mortes (${ref}: ${pct(b.league)})`}>
              <span className="tabular mb-1 text-center text-xs text-ink-2">{pct(b.share)}</span>
              <div className="rounded-t bg-accent" style={{ height: `${(b.share / top) * 80}%` }} />
              <span aria-hidden className="absolute inset-x-0 h-0.5 bg-ink" style={{ bottom: `${(b.league / top) * 80}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2 border-t border-axis pt-1">
          {timing.bins.map((b) => <span key={b.from} className="tabular flex-1 text-center text-[11px] text-muted">{label(b)}</span>)}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-2">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-accent align-middle" />mortes do jogador</span>
          <span><span className="mr-1 inline-block h-0.5 w-3 bg-ink align-middle" />{ref}</span>
          <span className="text-muted">{timing.n} mortes · tempo desde a queda da barreira</span>
        </p>
      </div>

      {timing.by_agent.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 font-medium">Agente</th>
                <th className="py-2 text-right font-medium">Mortes</th>
                <th className="py-2 text-right font-medium">Metade até</th>
                <th className="py-2 text-right font-medium">Primeiros {timing.early_s} s</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {timing.by_agent.map((a) => (
                <tr key={a.agent}>
                  <td className="py-2 text-ink">{a.agent} <span className="text-xs text-muted">({a.role})</span></td>
                  <td className="tabular py-2 text-right text-ink-2">{a.n}</td>
                  <td className="tabular py-2 text-right text-ink">{secs(a.median)} {a.league_median != null && <span className="text-xs text-muted">(ref. {secs(a.league_median)})</span>}</td>
                  <td className="tabular py-2 text-right text-ink">{pct(a.early)} {a.league_early != null && <span className="text-xs text-muted">(ref. {pct(a.league_early)})</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

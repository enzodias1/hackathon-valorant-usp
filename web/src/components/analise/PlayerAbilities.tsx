// Página do jogador: uso de habilidades por agente (pedido das entrevistas), comparado à média da liga no mesmo agente.
// A Riot só informa o total de usos por partida: não há o momento em que cada habilidade foi usada.
import { num } from "@/lib/format";
import type { PlayerAbilities } from "@/lib/types";

const n2 = (x: number) => num(x, 2);

function Row({ icon, label, name, value, league, max, unit }: {
  icon: string | null; label: string; name: string | null; value: number; league: number; max: number; unit: string;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_6.5rem] items-center gap-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {icon ? <img src={icon} alt="" className="h-5 w-5 shrink-0 opacity-90" /> : <span className="h-5 w-5 shrink-0" />}
        <span className="label-caps shrink-0 rounded-sm bg-surface-2 px-1 text-[10px] text-ink-2">{label}</span>
        <span className="truncate text-ink" title={name ?? undefined}>{name ?? "—"}</span>
      </span>
      <span className="relative h-2 rounded-full bg-surface-2" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(value / max) * 100}%` }} />
        <span className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${(league / max) * 100}%` }} />
      </span>
      <span className="tabular text-right text-xs">
        <span className="text-ink">{n2(value)}</span> <span className="text-muted">{unit}</span>
        <span className="block text-muted">média {n2(league)}</span>
      </span>
    </li>
  );
}

export function AbilitiesPanel({ abilities }: { abilities: PlayerAbilities[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        {abilities.map((a) => {
          const max = Math.max(...a.slots.flatMap((s) => [s.per_round, s.league]), 0.01) * 1.15;
          const umax = a.ult ? Math.max(a.ult.per_map, a.ult.league, 0.01) * 1.15 : 1;
          return (
            <div key={a.agent} className="rounded-xl border border-line bg-surface-2/40 px-4 py-3">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.icon && <img src={a.icon} alt="" className="h-7 w-7 rounded" />}
                <span className="font-display text-lg uppercase tracking-wide text-ink">{a.agent}</span>
                <span className="ml-auto text-xs text-muted">{a.maps} mapas · {a.rounds} rounds</span>
              </div>
              <ul className="mt-1 divide-y divide-line/50">
                {a.slots.map((s) => <Row key={s.key} icon={s.icon} label={s.key} name={s.name} value={s.per_round} league={s.league} max={max} unit="/round" />)}
                {a.ult ? <Row icon={a.ult.icon} label="X" name={a.ult.maps < a.maps ? `${a.ult.name} (${a.ult.maps} de ${a.maps} mapas)` : a.ult.name} value={a.ult.per_map} league={a.ult.league} max={umax} unit="/mapa" />
                  : <li className="py-2 text-xs text-muted">Ultimate: a Riot não registra a do Chamber a partir do patch 13.02.</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-4 text-xs text-ink-2">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-accent align-middle" />jogador</span>
        <span><span className="mr-1 inline-block h-3 w-0.5 bg-ink align-middle" />média da liga no mesmo agente</span>
        <span className="text-muted">Habilidades por round; ultimate por mapa (no Chamber, só os mapas antes do patch 13.02, em que a Riot a contava). Só agentes com 2+ mapas.</span>
      </p>
    </div>
  );
}

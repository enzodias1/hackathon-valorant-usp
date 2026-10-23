"use client";
// Controles dos filtros das listas (Client Components).
import { useEffect, useState } from "react";

const FIELD = "rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none";

export function SelectFilter({ label, value, onChange, options, all = "Todos" }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; all?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function SearchFilter({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${FIELD} placeholder:text-muted`} />
    </label>
  );
}

export function ResultCount({ shown, total, noun, onClear }: { shown: number; total: number; noun: string; onClear?: () => void }) {
  return (
    <p className="text-sm text-ink-2">
      <span className="tabular text-ink">{shown}</span> de <span className="tabular">{total}</span> {noun}
      {onClear && shown !== total && (
        <button type="button" onClick={onClear} className="ml-3 text-accent underline-offset-4 hover:underline">limpar filtros</button>
      )}
    </p>
  );
}

/** Busca sem acentos e sem caixa: "univava" encontra "UNIVAVÁ". */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Estado dos filtros espelhado na URL (?time=...&mapa=...), para dar para compartilhar o link já filtrado.
 * A página é estática: lê a URL só depois de montar, e a primeira renderização mostra tudo.
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const empty = Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;
  const [filters, setFilters] = useState(empty);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFilters(Object.fromEntries(keys.map((k) => [k, q.get(k) ?? ""])) as Record<K, string>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: Record<K, string>) => {
    setFilters(next);
    const q = new URLSearchParams();
    for (const k of keys) if (next[k]) q.set(k, next[k]);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  };

  return {
    filters,
    set: (k: K, v: string) => update({ ...filters, [k]: v }),
    /** vários de uma vez (duas chamadas de set seguidas se sobrescreveriam) */
    setMany: (patch: Partial<Record<K, string>>) => update({ ...filters, ...patch }),
    clear: () => update(empty),
  };
}

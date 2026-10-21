"use client";
// Botão "i" que abre uma explicação curta num balão (no lugar de parágrafos longos sob os títulos).
// Funciona dentro de <summary> (não abre/fecha a seção), com teclado (Esc fecha) e toque.
import { useEffect, useId, useRef, useState } from "react";

export default function InfoTip({ text, label = "Como ler", align = "left" }: {
  text: React.ReactNode; label?: string;
  /** de que lado o balão se apoia: "right" perto da borda direita da tela, para não sair dela */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button type="button" aria-label={label} aria-expanded={open} aria-controls={id} title={label}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
              className={`grid h-6 w-6 place-items-center rounded-full border text-xs font-bold normal-case tracking-normal transition-colors ${
                open ? "border-lime bg-lime text-bg" : "border-lime/60 bg-lime/10 text-lime hover:border-lime hover:bg-lime hover:text-bg"}`}>
        i
      </button>
      {open && (
        <span id={id} role="tooltip"
              className={`absolute top-8 z-30 w-[min(22rem,80vw)] rounded-lg border border-line bg-surface-2 p-3 text-left text-sm font-normal normal-case leading-relaxed tracking-normal text-ink-2 shadow-xl ${
                align === "right" ? "right-0" : "left-0"}`}
              onClick={(e) => e.stopPropagation()}>
          {text}
        </span>
      )}
    </span>
  );
}

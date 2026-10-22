"use client";
// Apresentação em telas: cada <section data-slide> ocupa a altura da tela. Setas, PageUp/PageDown e espaço passam de tela;
// F (ou o botão) põe em tela cheia, sem o menu lateral. Também dá para rolar normalmente.
import { useCallback, useEffect, useRef, useState } from "react";

export default function Deck({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const [total, setTotal] = useState(0);
  const [full, setFull] = useState(false);

  const slides = () => [...(ref.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? [])];
  const go = useCallback((i: number) => {
    const s = slides();
    s[Math.max(0, Math.min(s.length - 1, i))]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else ref.current?.requestFullscreen?.();
  }, []);

  // tela atual: a que ocupa a maior parte da área visível
  useEffect(() => {
    const s = slides();
    setTotal(s.length);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCur(s.indexOf(e.target as HTMLElement));
    }, { root: ref.current, threshold: 0.55 });
    s.forEach((el) => io.observe(el));
    const onFs = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => { io.disconnect(); document.removeEventListener("fullscreenchange", onFs); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const next = ["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key);
      const prev = ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key);
      if (next || prev) { e.preventDefault(); go(cur + (next ? 1 : -1)); }
      else if (e.key === "Home") { e.preventDefault(); go(0); }
      else if (e.key === "End") { e.preventDefault(); go(total - 1); }
      else if (e.key === "f" || e.key === "F") toggleFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, total, go, toggleFull]);

  return (
    <div ref={ref} className="relative h-[100dvh] snap-y snap-mandatory overflow-y-auto bg-bg" aria-roledescription="apresentação">
      {children}
      <nav aria-label="Navegação da apresentação"
           className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full border border-line bg-surface/90 px-2 py-1.5 text-xs text-ink-2 shadow-xl backdrop-blur">
        <button type="button" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="Tela anterior"
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2 hover:text-ink disabled:opacity-30">↑</button>
        <span className="tabular min-w-[3.5rem] text-center">{total ? `${cur + 1} / ${total}` : ""}</span>
        <button type="button" onClick={() => go(cur + 1)} disabled={cur >= total - 1} aria-label="Próxima tela"
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2 hover:text-ink disabled:opacity-30">↓</button>
        <button type="button" onClick={toggleFull} aria-pressed={full} title="Tela cheia (F)"
                className="label-caps ml-1 rounded-full px-2 py-1 text-[10px] hover:bg-surface-2 hover:text-ink">{full ? "Sair" : "⛶ Tela cheia"}</button>
      </nav>
    </div>
  );
}

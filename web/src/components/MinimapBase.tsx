// Base reaproveitável de tudo que é desenhado sobre o minimapa: a imagem + um <svg viewBox="0 0 1 1"> por cima.
// - `children` entra DENTRO do SVG, em coordenadas 0–1 (use toMinimap de @/lib/minimap).
// - `overlay` é HTML posicionado por cima (tooltips, rótulos), com left/top em % da imagem.
// Sem hooks nem "use client": funciona em Server e Client Components (minimapa do round, mapa de calor das zonas).
import type { ReactNode } from "react";

export default function MinimapBase({
  src,
  alt = "Minimapa",
  children,
  overlay,
  className = "",
}: {
  src: string | null;
  alt?: string;
  children?: ReactNode;
  overlay?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative aspect-square w-full select-none rounded-lg border border-line bg-surface-2 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem estática externa, sem otimização do Next
        <img src={src} alt={alt} draggable={false} className="absolute inset-0 h-full w-full rounded-lg object-contain" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted">Minimapa indisponível</div>
      )}
      <svg viewBox="0 0 1 1" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {children}
      </svg>
      {overlay}
    </div>
  );
}

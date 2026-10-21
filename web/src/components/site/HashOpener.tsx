"use client";
// Link com âncora para uma seção recolhida (ex.: /times/x#sinergia) abre a seção em vez de parar no título fechado.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function openTarget() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (!el) return;
  for (let d: HTMLElement | null = el; d; d = d.parentElement) if (d instanceof HTMLDetailsElement) d.open = true;
  el.scrollIntoView();
}

export default function HashOpener() {
  const path = usePathname();
  useEffect(() => {
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, [path]);
  return null;
}

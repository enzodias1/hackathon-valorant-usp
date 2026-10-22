"use client";
// Cabeçalho que só aparece na impressão / PDF: nome do site, título da página, data e link, para quem recebe o arquivo.
import { useEffect, useState } from "react";
import { PRODUCT_NAME } from "@/lib/site";

export default function PrintHeader() {
  const [info, setInfo] = useState({ title: "", date: "", url: "" });

  useEffect(() => {
    const update = () => setInfo({
      // durante o "Exportar PDF" o título vira "Nome — Analista UNIVAVÁ — data"; numa impressão comum, "Nome · Analista UNIVAVÁ"
      title: document.title.includes(" — ") ? document.title.split(" — ")[0] : document.title.replace(` · ${PRODUCT_NAME}`, ""),
      date: new Date().toLocaleDateString("pt-BR"),
      // com a busca: no comparar, ?a=...&b=... são os times escolhidos
      url: `${window.location.host}${window.location.pathname}${window.location.search}`,
    });
    update();
    // "pdfexport" vem do botão Exportar PDF, antes da impressão, para dar tempo de redesenhar
    window.addEventListener("beforeprint", update);
    window.addEventListener("pdfexport", update);
    return () => { window.removeEventListener("beforeprint", update); window.removeEventListener("pdfexport", update); };
  }, []);

  return (
    <div className="print-header hidden items-end justify-between gap-6 border-b border-line pb-3">
      <div>
        <p className="label-caps text-[10px] text-lime">{PRODUCT_NAME}</p>
        <p className="text-lg leading-tight text-ink">{info.title}</p>
      </div>
      <p className="min-w-0 max-w-[60%] text-right text-xs break-all text-ink-2">Gerado em {info.date}<br />{info.url}</p>
    </div>
  );
}

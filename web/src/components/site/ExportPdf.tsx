"use client";
// Botão "Exportar PDF": lista as seções da página (marcadas com data-pdf-section), deixa desmarcar as que não interessam
// e imprime só as marcadas pela impressão do navegador ("Salvar como PDF": texto selecionável e gráficos SVG nítidos).
// Atributos que as páginas usam:
//   data-pdf-section="Nome"      seção que aparece na lista
//   data-pdf-default="off"       começa desmarcada (ex.: o replay, que sairia como foto de um instante)
//   data-pdf-title="Texto"       título do relatório quando o botão não recebe `title` (ex.: os times escolhidos no comparar)
//   data-print-hide              some na impressão (menu, botões, filtros); o CSS fica em globals.css
import { useEffect, useRef, useState } from "react";
import { PRODUCT_NAME } from "@/lib/site";

type Item = { el: HTMLElement; name: string; checked: boolean };

const today = () => {
  const d = new Date();
  return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map((n) => String(n).padStart(2, "0")).join("-");
};

export default function ExportPdf({ title }: { title?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const restore = useRef<(() => void) | null>(null);

  // se a página for desmontada com a impressão aberta, desfaz as mudanças
  useEffect(() => () => restore.current?.(), []);

  const open = () => {
    const found = [...document.querySelectorAll<HTMLElement>("[data-pdf-section]")]
      .map((el) => ({ el, name: el.dataset.pdfSection ?? "", checked: el.dataset.pdfDefault !== "off" }));
    setItems(found);
    dialog.current?.showModal();
  };

  const setAll = (checked: boolean) => setItems((xs) => xs.map((x) => ({ ...x, checked })));
  const toggle = (i: number) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)));

  const print = async () => {
    dialog.current?.close();
    const html = document.documentElement;
    const hidden = items.filter((x) => !x.checked).map((x) => x.el);
    hidden.forEach((el) => el.setAttribute("data-pdf-hide", ""));
    // seções recolhíveis abertas no PDF (guardando como estavam)
    const details = [...document.querySelectorAll("details")].map((d) => [d, d.open] as const);
    details.forEach(([d]) => { d.open = true; });
    const oldTitle = document.title;
    const name = title ?? document.querySelector<HTMLElement>("[data-pdf-title]")?.dataset.pdfTitle ?? oldTitle.split(" · ")[0];
    document.title = `${name} — ${PRODUCT_NAME} — ${today()}`;
    // largura de uma folha A4 já na tela: os gráficos (Recharts) se redimensionam antes de a impressão começar
    html.classList.add("pdf-mode");
    window.dispatchEvent(new Event("pdfexport"));

    let done = false;
    const undo = () => {
      if (done) return;
      done = true;
      hidden.forEach((el) => el.removeAttribute("data-pdf-hide"));
      details.forEach(([d, wasOpen]) => { d.open = wasOpen; });
      document.title = oldTitle;
      html.classList.remove("pdf-mode");
      window.removeEventListener("afterprint", undo);
      restore.current = null;
      window.dispatchEvent(new Event("resize"));
    };
    restore.current = undo;
    window.addEventListener("afterprint", undo);

    window.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 500));
    window.print(); // o afterprint (todos os navegadores atuais) desfaz as mudanças
  };

  const count = items.filter((x) => x.checked).length;
  return (
    <>
      <button type="button" onClick={open} data-print-hide
              className="label-caps flex items-center gap-2 border-2 border-white/90 px-5 py-2.5 text-[11px] text-white transition-colors hover:bg-white hover:text-brand">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />
        </svg>
        Exportar PDF
      </button>

      <dialog ref={dialog} aria-labelledby="pdf-title" data-print-hide
              className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/70">
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (count) print(); }} className="flex max-h-[85vh] flex-col">
          <div className="border-b border-line p-5">
            <h2 id="pdf-title" className="text-2xl tracking-wide">Exportar PDF</h2>
            <p className="mt-1 text-sm text-ink-2">Escolha as seções do relatório. Na janela de impressão, selecione <b className="text-ink">Salvar como PDF</b>.</p>
          </div>
          <div className="flex gap-4 px-5 pt-4 text-sm">
            <button type="button" onClick={() => setAll(true)} className="text-lime underline-offset-4 hover:underline">Marcar todas</button>
            <button type="button" onClick={() => setAll(false)} className="text-lime underline-offset-4 hover:underline">Desmarcar todas</button>
            <span className="ml-auto text-muted">{count} de {items.length}</span>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 py-3">
            {items.map((x, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input type="checkbox" checked={x.checked} onChange={() => toggle(i)} className="h-4 w-4 accent-lime" />
                  <span>{x.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-3 border-t border-line p-4">
            <button type="button" onClick={() => dialog.current?.close()} className="label-caps px-4 py-2.5 text-[11px] text-ink-2 hover:text-ink">Cancelar</button>
            <button type="submit" disabled={!count}
                    className="label-caps bg-lime px-5 py-2.5 text-[11px] text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              Gerar PDF
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

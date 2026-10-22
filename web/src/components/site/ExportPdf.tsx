"use client";
// Botão "Exportar PDF": lista as seções da página (marcadas com data-pdf-section), deixa desmarcar as que não interessam
// e imprime só as marcadas pela impressão do navegador ("Salvar como PDF": texto selecionável e gráficos SVG nítidos).
// Atributos que as páginas usam:
//   data-pdf-section="Nome"      seção que aparece na lista
//   data-pdf-default="off"       começa desmarcada (ex.: o replay, que sairia como foto de um instante)
//   data-pdf-title="Texto"       título do relatório quando o botão não recebe `title` (ex.: os times escolhidos no comparar)
//   data-print-hide              some na impressão (menu, botões, filtros); o CSS fica em globals.css
//   data-pdf-choices='{"label", "options": [{value, label}], "selected": [...]}'
//                                dentro de uma seção: opções extras na lista (ex.: os mapas de "Onde o time morre"). Ao gerar, o
//                                elemento recebe o evento "pdf-choices" com os valores marcados (e com null depois da impressão)
import { useEffect, useRef, useState } from "react";
import { PRODUCT_NAME } from "@/lib/site";

type Choices = { target: HTMLElement; label: string; options: { value: string; label: string }[]; initial: string[]; selected: string[] };
type Item = { el: HTMLElement; name: string; checked: boolean; choices?: Choices };

function readChoices(section: HTMLElement): Choices | undefined {
  const target = section.querySelector<HTMLElement>("[data-pdf-choices]");
  if (!target) return undefined;
  try {
    const c = JSON.parse(target.dataset.pdfChoices ?? "");
    return { target, label: c.label, options: c.options, initial: c.selected, selected: c.selected };
  } catch {
    return undefined;
  }
}

/** Espera as imagens que entraram na página (ex.: minimapas dos mapas escolhidos), até 8 s. */
function imagesLoaded() {
  const pending = [...document.images].filter((img) => !img.complete);
  const loaded = Promise.all(pending.map((img) => new Promise((r) => {
    img.addEventListener("load", r, { once: true });
    img.addEventListener("error", r, { once: true });
  })));
  return Promise.race([loaded, new Promise((r) => setTimeout(r, 8000))]);
}

/** A seção entra no PDF se estiver marcada e, quando tem opções, com pelo menos uma marcada. */
const included = (x: Item) => x.checked && (!x.choices || x.choices.selected.length > 0);

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
      .map((el) => ({ el, name: el.dataset.pdfSection ?? "", checked: el.dataset.pdfDefault !== "off", choices: readChoices(el) }));
    setItems(found);
    dialog.current?.showModal();
  };

  const setAll = (checked: boolean) => setItems((xs) => xs.map((x) => ({ ...x, checked })));
  const toggle = (i: number) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)));
  const setChoices = (i: number, f: (c: Choices) => string[]) =>
    setItems((xs) => xs.map((x, j) => (j === i && x.choices ? { ...x, choices: { ...x.choices, selected: f(x.choices) } } : x)));
  const toggleChoice = (i: number, v: string) =>
    setChoices(i, (c) => (c.selected.includes(v) ? c.selected.filter((s) => s !== v) : [...c.selected, v]));

  const print = async () => {
    dialog.current?.close();
    const html = document.documentElement;
    const hidden = items.filter((x) => !included(x)).map((x) => x.el);
    hidden.forEach((el) => el.setAttribute("data-pdf-hide", ""));
    // opções escolhidas (ex.: mapas): a seção redesenha para o PDF
    const withChoices = items.filter((x) => included(x) && x.choices).map((x) => x.choices!);
    withChoices.forEach((c) => c.target.dispatchEvent(new CustomEvent("pdf-choices", { detail: c.selected })));
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
      withChoices.forEach((c) => c.target.dispatchEvent(new CustomEvent("pdf-choices", { detail: null })));
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
    await imagesLoaded();
    window.print(); // o afterprint (todos os navegadores atuais) desfaz as mudanças
  };

  const count = items.filter(included).length;
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
              className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/70">
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
                <label data-pdf-item className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input type="checkbox" checked={x.checked} onChange={() => toggle(i)} className="h-4 w-4 accent-lime" />
                  <span>{x.name}</span>
                </label>
                {x.choices && x.checked && (
                  <fieldset className="mb-2 ml-9 mt-1 rounded-md border border-line p-3">
                    <legend className="px-1 text-xs text-ink-2">{x.choices.label}</legend>
                    <div className="mb-2 flex gap-3 text-xs">
                      <button type="button" onClick={() => setChoices(i, (c) => c.options.map((o) => o.value))} className="text-lime underline-offset-4 hover:underline">Todos</button>
                      <button type="button" onClick={() => setChoices(i, (c) => c.initial)} className="text-lime underline-offset-4 hover:underline">Só o da tela</button>
                      <span className="ml-auto text-muted">{x.choices.selected.length} de {x.choices.options.length}</span>
                    </div>
                    <div className="grid gap-x-3 sm:grid-cols-2">
                      {x.choices.options.map((o) => (
                        <label key={o.value} data-pdf-choice className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-2">
                          <input type="checkbox" checked={x.choices!.selected.includes(o.value)} onChange={() => toggleChoice(i, o.value)} className="h-3.5 w-3.5 accent-lime" />
                          <span className="text-ink-2">{o.label}</span>
                        </label>
                      ))}
                    </div>
                    {!x.choices.selected.length && <p className="mt-1 text-xs text-warn">Nenhum marcado: a seção fica de fora do PDF.</p>}
                  </fieldset>
                )}
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

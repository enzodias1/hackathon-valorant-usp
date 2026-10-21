// Peças comuns das imagens de prévia de link (app/opengraph-image.tsx e partidas/[id]/opengraph-image.tsx).

export const OG_SIZE = { width: 1200, height: 630 };

// cores do tema (globals.css); o ImageResponse não lê variáveis CSS
export const OG_COLORS = { brand: "#4a1fe0", bg: "#0c0a1d", white: "#ffffff", lime: "#d4f83a" };

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };
const cache = new Map<string, Promise<Font | null>>();

async function download(family: string, weight: 400 | 700): Promise<Font | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
      const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
      if (url) return { name: family, data: await (await fetch(url)).arrayBuffer(), weight, style: "normal" };
    } catch {
      // tenta de novo
    }
  }
  console.warn(`[og] fonte ${family} ${weight} indisponível; usando a fonte padrão`);
  return null;
}

/** Fonte do Google Fonts (completa), baixada uma vez por build; uma falha não fica no cache. */
export function googleFont(family: string, weight: 400 | 700) {
  const key = `${family}:${weight}`;
  if (!cache.has(key)) {
    const p = download(family, weight);
    cache.set(key, p);
    p.then((f) => { if (!f) cache.delete(key); });
  }
  return cache.get(key)!;
}

/**
 * Opções de fonte para o ImageResponse: Anton (títulos) e Geist (texto). Sem nenhuma fonte baixada, não passa a lista
 * (lista vazia derruba o build com "No fonts are loaded"; sem ela, entra a fonte padrão).
 */
export async function ogFonts() {
  const fonts = (await Promise.all([googleFont("Anton", 400), googleFont("Geist", 700), googleFont("Geist", 400)])).filter((f): f is Font => f != null);
  return fonts.length ? { fonts } : {};
}

/** O Satori alarga o espaço antes de palavras acentuadas; com espaço não separável fica uniforme. */
export const nb = (s: string) => s.replace(/ /g, " ");

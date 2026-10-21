// Imagem da prévia de link (Discord, WhatsApp, X...). Gerada no build; vale para todas as páginas.
import { ImageResponse } from "next/og";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME, TAGLINE } from "@/lib/site";

export const alt = `${PRODUCT_NAME}: ${TAGLINE.toLowerCase()}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// cores do tema (globals.css); o ImageResponse não lê variáveis CSS
const C = { bg: "#0d0d0d", surface: "#1a1a19", ink: "#f0efec", ink2: "#c3c2b7", muted: "#898781", line: "#2c2c2a", accent: "#3987e5", red: "#e66767", blue: "#3987e5" };

/** Geist do Google Fonts (completa: o recorte só com as letras usadas deixava espaços tortos). Sem rede, cai na fonte padrão. */
async function geist(weight: number) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return { name: "Geist", data: await (await fetch(url)).arrayBuffer(), weight: weight as 400 | 700, style: "normal" as const };
  } catch {
    return null;
  }
}

// O Satori alarga o espaço antes de palavras acentuadas; com espaço não separável fica uniforme.
const nb = (s: string) => s.replace(/ /g, " ");

/** Quebra o título em duas linhas de tamanho parecido (sem espaços quebráveis, a quebra é feita aqui). */
function twoLines(text: string) {
  const words = text.split(" ");
  let best = 1;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - text.length / 2);
    if (d < Math.abs(words.slice(0, best).join(" ").length - text.length / 2)) best = i;
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")].map(nb);
}

// curva estilizada de chance de vitória ao longo de um round (só decoração)
const WP = [50, 48, 63, 55, 71, 66, 82, 40, 34, 52, 77, 91, 97];

export default async function OpenGraphImage() {
  const index = await getIndex();
  const stats = [
    [index.matches.length, "partidas"],
    [index.team_list.length, "times"],
    [index.players.length, "jogadores"],
  ] as const;
  const kicker = "Análise pós-partida · VALORANT universitário";
  const fonts = (await Promise.all([geist(700), geist(400)]))
    .filter((f): f is NonNullable<typeof f> => f != null);

  const W = 1200, H = 150, step = W / (WP.length - 1);
  const pts = WP.map((v, i) => `${i * step},${H - (v / 100) * H}`).join(" ");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.ink, fontFamily: "Geist" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px 0", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative" }}>
            <div style={{ position: "absolute", right: 0, fontSize: 24, color: C.muted }}>analista-univava.vercel.app</div>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: C.accent, color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 700 }}>A</div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{PRODUCT_NAME}</div>
          </div>
          <div style={{ marginTop: 56, fontSize: 26, color: C.accent, letterSpacing: 1 }}>{nb(kicker)}</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            {twoLines(`${TAGLINE}.`).map((line) => <div key={line}>{line}</div>)}
          </div>
          <div style={{ marginTop: 36, display: "flex", gap: 40, fontSize: 28, color: C.ink2 }}>
            {stats.map(([n, l]) => (
              <div key={l} style={{ display: "flex", gap: 10 }}>
                <span style={{ color: C.ink, fontWeight: 700 }}>{n.toLocaleString("pt-BR")}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", height: H }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
            <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={C.line} strokeWidth="2" strokeDasharray="6 8" />
            <polyline points={pts} fill="none" stroke={C.accent} strokeWidth="5" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

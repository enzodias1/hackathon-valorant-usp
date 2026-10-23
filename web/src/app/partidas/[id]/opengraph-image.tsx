// Prévia de link de uma partida (Discord, WhatsApp...): faixa roxa com o splash do mapa ao fundo, placar e vencedor em verde-limão.
// Gerada no build para todas as partidas, como a própria página.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getIndex, getMatch } from "@/lib/data";
import { competitionLabel, date } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/site";
import type { Color } from "@/lib/types";
import { OG_COLORS as C, OG_SIZE, nb, ogFonts } from "../../_og/og";

export const alt = "Placar, mapa e competição da partida";
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await getIndex()).matches.map((m) => ({ id: m.id }));
}

/** Splash do mapa em tons de cinza (gerado por scripts/og-maps.mjs); sem arquivo, fica só o roxo. */
async function mapBackground(code: string) {
  try {
    const jpg = await readFile(path.join(process.cwd(), "src", "app", "_og", "maps", `${code.toLowerCase()}.png`));
    return `data:image/png;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function MatchOpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMatch((await params).id);
  const [fonts, bg] = await Promise.all([ogFonts(), mapBackground(m.map.code)]);

  const row = (c: Color) => {
    const won = m.winner === c;
    const color = won ? C.lime : C.white;
    return (
      <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: won ? 1 : 0.75 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, maxWidth: 880 }}>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 76, lineHeight: 1.1, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nb(m.teams[c].name.toUpperCase())}
          </div>
          {won && <div style={{ display: "flex", background: C.lime, color: C.bg, fontSize: 18, fontWeight: 700, letterSpacing: 3, padding: "4px 10px" }}>VENCEU</div>}
        </div>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: 104, lineHeight: 1, color }}>{m.score[c]}</div>
      </div>
    );
  };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: C.brand, color: C.white, fontFamily: "Geist", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bg && <img src={bg} alt="" width={size.width} height={size.height} style={{ position: "absolute", left: 0, top: 0, opacity: 0.4 }} />}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "46px 64px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", fontFamily: "Anton", fontSize: 34, letterSpacing: 1 }}>{PRODUCT_NAME.toUpperCase()}</div>
            </div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3, opacity: 0.85 }}>
              {nb(`${competitionLabel(m.competition, m.stage)} · ${date(m.date)}`.toUpperCase())}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {row("Red")}
            {row("Blue")}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", background: C.lime, color: C.bg, fontFamily: "Anton", fontSize: 36, letterSpacing: 2, padding: "2px 16px" }}>{m.map.name.toUpperCase()}</div>
            <div style={{ display: "flex", fontSize: 22, opacity: 0.85 }}>{nb("Chance de vitória round a round e replay de cada jogada")}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, ...fonts },
  );
}

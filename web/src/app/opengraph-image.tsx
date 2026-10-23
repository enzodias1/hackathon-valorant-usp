// Imagem da prévia de link (Discord, WhatsApp, X...). Gerada no build; vale para todas as páginas.
// Mesma identidade da apresentação, que é onde o link abre: fundo roxo, título condensado (Anton), tarja verde-limão e a Fade
// (arte oficial, política "Legal Jibber Jabber" da Riot).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getIndex } from "@/lib/data";
import { PRODUCT_NAME, TAGLINE } from "@/lib/site";
import { OG_COLORS, OG_SIZE, nb, ogFonts } from "./_og/og";

export const alt = `${PRODUCT_NAME}: ${TAGLINE.toLowerCase()}`;
export const size = OG_SIZE;
export const contentType = "image/png";

const C = OG_COLORS;

export default async function OpenGraphImage() {
  const index = await getIndex();
  const stats = [
    [index.matches.length, "mapas"],
    [index.team_list.length, "times"],
    [index.players.length, "jogadores"],
  ] as const;
  const fonts = await ogFonts();
  const agent = `data:image/png;base64,${(await readFile(path.join(process.cwd(), "src", "app", "_og", "fade_og.png"))).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: C.brand, color: C.white, fontFamily: "Geist", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={agent} alt="" height={700} style={{ position: "absolute", right: 70, top: -10 }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "46px 64px", width: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: "Anton", fontSize: 40, letterSpacing: 1 }}>{PRODUCT_NAME.toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontFamily: "Anton", fontSize: 72, lineHeight: 1.04 }}>
            {["O ANALISTA QUE", "OS TIMES UNIVERSITÁRIOS", "NÃO TÊM"].map((l) => <div key={l}>{nb(l)}</div>)}
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <div style={{ background: C.lime, color: C.bg, fontSize: 22, fontWeight: 700, letterSpacing: 4, padding: "8px 18px" }}>{nb("ANÁLISE PÓS-PARTIDA")}</div>
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 24 }}>
            {stats.map(([n, l]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "Anton", fontSize: 46, lineHeight: 1 }}>{n.toLocaleString("pt-BR")}</span>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, opacity: 0.8 }}>{l.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, ...fonts },
  );
}

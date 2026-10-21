// Gera os fundos da prévia de link das partidas (src/app/_og/maps/<código>.png) a partir dos splashes em public/art/maps.
// O ImageResponse não lê WebP: aqui viram PNG 1200x630 em poucos tons de cinza (a cor roxa entra por cima, na própria imagem).
// Desfocados e posterizados porque a prévia final é PNG: com a foto nítida cada uma tinha ~700 KB, e o WhatsApp ignora prévias pesadas.
// Rodar só quando os splashes mudarem:  node scripts/og-maps.mjs
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const src = path.join("public", "art", "maps");
const out = path.join("src", "app", "_og", "maps");
await mkdir(out, { recursive: true });
for (const f of (await readdir(src)).filter((f) => f.endsWith(".webp"))) {
  const dest = path.join(out, f.replace(".webp", ".png"));
  const grey = await sharp(path.join(src, f)).resize(1200, 630, { fit: "cover" }).greyscale().blur(4).toBuffer();
  // apaga a foto à esquerda, onde fica o texto (no lugar de um degradê por cima, que deixaria a prévia pesada)
  const fade = Buffer.from(`<svg width="1200" height="630"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="0.35" stop-color="#000" stop-opacity="0.85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`);
  await sharp(grey).composite([{ input: fade }]).greyscale().png({ palette: true, colors: 5, dither: 0 }).toFile(dest);
  console.log(dest);
}

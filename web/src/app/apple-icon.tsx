// Ícone para "adicionar à tela de início" no iPhone: o mesmo "E" (Espreitador) do ícone do site.
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#4a1fe0" }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M9.5 6.5h13v4h-8.5v3.5h7.5v4h-7.5v3.5h8.5v4h-13z" fill="#d4f83a" />
        </svg>
      </div>
    ),
    size,
  );
}

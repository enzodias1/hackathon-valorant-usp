// Ícone para "adicionar à tela de início" no iPhone: o mesmo "A" do cabeçalho.
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3987e5" }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M16 6.5 24.5 25.5h-4.1l-1.6-3.8h-5.6l-1.6 3.8H7.5L16 6.5Zm0 8.2-1.8 4.3h3.6L16 14.7Z" fill="#0d0d0d" />
        </svg>
      </div>
    ),
    size,
  );
}

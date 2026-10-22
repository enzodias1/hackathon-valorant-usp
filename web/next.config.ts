import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // endereços antigos continuam funcionando: a apresentação virou a primeira tela do site, e o "Como usar" saiu
  // (as definições dos números foram para os botões "i" de cada tela)
  async redirects() {
    return [
      { source: "/apresentacao", destination: "/", permanent: false },
      { source: "/como-funciona", destination: "/inicio", permanent: false },
    ];
  },
};

export default nextConfig;

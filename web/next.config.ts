import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // a apresentação virou a primeira tela do site; o endereço antigo continua funcionando
  async redirects() {
    return [{ source: "/apresentacao", destination: "/", permanent: false }];
  },
};

export default nextConfig;

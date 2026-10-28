import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf se carga como módulo ESM nativo en el servidor (generación de PDF)
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;

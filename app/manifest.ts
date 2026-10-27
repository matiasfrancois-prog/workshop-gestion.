import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" en el celular y abrirla como app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Work Shop · Gestión",
    short_name: "Work Shop",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ee",
    theme_color: "#12584c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

import type { MetadataRoute } from "next";

/** Web App Manifest — permite "Adicionar à tela de início" como app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Global Fisio",
    short_name: "Global Fisio",
    description: "Gestão de pacientes de fisioterapia",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f8",
    theme_color: "#0e7490",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

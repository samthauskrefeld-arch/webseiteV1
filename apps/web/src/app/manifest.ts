import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Minijob",
    short_name: "My Minijob",
    description: "Finde Hilfe. Finde Arbeit. Ganz einfach.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F9FC",
    theme_color: "#14263D",
    lang: "de",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    categories: ["business", "productivity"],
  };
}

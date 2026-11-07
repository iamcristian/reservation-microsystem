import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clínica Dental Sonrisa — Reservas Online",
    short_name: "Reservas",
    description:
      "Agenda tu cita en segundos. Sistema inteligente de reservas para consultorios, clínicas y barberías en Cochabamba.",
    start_url: "/",
    display: "standalone",
    background_color: "#EBEBEF",
    theme_color: "#1F1F23",
    orientation: "portrait",
    lang: "es-BO",
    categories: ["medical", "health", "lifestyle", "business"],
    icons: [
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='44' fill='%231F1F23'/%3E%3Ccircle cx='96' cy='96' r='54' fill='none' stroke='%23ffffff' stroke-width='10'/%3E%3Cpath d='M96 66v34l22 14' stroke='%2310B981' stroke-width='10' stroke-linecap='round' fill='none'/%3E%3C/svg%3E",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='112' fill='%231F1F23'/%3E%3Ccircle cx='256' cy='256' r='144' fill='none' stroke='%23ffffff' stroke-width='26'/%3E%3Cpath d='M256 176v90l58 38' stroke='%2310B981' stroke-width='26' stroke-linecap='round' fill='none'/%3E%3C/svg%3E",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

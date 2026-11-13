import type { MetadataRoute } from "next";
import { getSeoProfile } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const seo = await getSeoProfile();

  return {
    id: "/",
    name: `${seo.businessName} — Reservas Online`,
    short_name: seo.shortName,
    description: seo.seoDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EBEBEF",
    theme_color: seo.themePrimaryHex,
    orientation: "portrait",
    lang: "es-BO",
    categories: ["medical", "health", "lifestyle", "business"],
    icons: [
      {
        src: `/icon/192?v=${seo.versionTag}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon/192?v=${seo.versionTag}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `/icon/512?v=${seo.versionTag}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon/512?v=${seo.versionTag}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

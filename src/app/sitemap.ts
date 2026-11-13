import type { MetadataRoute } from "next";
import { getSeoProfile, resolveSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [siteUrl, seo] = await Promise.all([resolveSiteUrl(), getSeoProfile()]);

  return [
    {
      url: `${siteUrl}/`,
      lastModified: seo.updatedAtIso,
      changeFrequency: "daily",
      priority: 1.0,
      images: [`${siteUrl}/opengraph-image?v=${seo.versionTag}`],
    },
    {
      url: `${siteUrl}/terminos`,
      lastModified: seo.updatedAtIso,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/privacidad`,
      lastModified: seo.updatedAtIso,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/cookies`,
      lastModified: seo.updatedAtIso,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}

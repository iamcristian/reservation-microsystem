import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/manifest.webmanifest", "/opengraph-image", "/twitter-image", "/icon/"],
        disallow: ["/admin", "/admin/", "/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/opengraph-image", "/icon/"],
        disallow: ["/admin", "/admin/", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

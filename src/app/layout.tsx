import type { Metadata, Viewport } from "next";
import { buildJsonLd, getSeoProfile, resolveSiteUrl } from "@/lib/seo";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateViewport(): Promise<Viewport> {
  const seo = await getSeoProfile();
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: seo.themePrimaryHex,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const [siteUrl, seo] = await Promise.all([resolveSiteUrl(), getSeoProfile()]);
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: seo.seoTitle,
      template: `%s | ${seo.businessName}`,
    },
    description: seo.seoDescription,
    applicationName: seo.businessName,
    keywords: seo.keywords,
    authors: [{ name: seo.businessName }],
    creator: seo.businessName,
    publisher: seo.businessName,
    category: seo.category,
    alternates: {
      canonical: "/",
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: seo.shortName,
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: "website",
      locale: "es_BO",
      url: siteUrl,
      siteName: seo.businessName,
      title: seo.ogTitle,
      description: seo.ogDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.ogTitle,
      description: seo.ogDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    ...(googleVerification
      ? {
          verification: {
            google: googleVerification,
          },
        }
      : {}),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [siteUrl, seo] = await Promise.all([resolveSiteUrl(), getSeoProfile()]);
  const jsonLd = buildJsonLd(seo, siteUrl);
  const safeJsonLdString = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <html lang="es" className="h-full">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdString }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#EBEBEF] text-[#1F1F23] antialiased">
        {children}
      </body>
    </html>
  );
}

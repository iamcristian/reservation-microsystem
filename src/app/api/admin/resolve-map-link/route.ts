import { NextResponse } from "next/server";
import {
  requireAdmin,
  safeErrorResponse,
  verifySameOrigin,
} from "@/lib/api-guard";
import {
  buildGoogleMapsUrl,
  isValidCoords,
  parseCoordinatesFromUrl,
} from "@/lib/geo";

export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 6;
const MAX_HTML_CHARS = 250_000;

const GOOGLE_HOST_REGEX = /^(?:maps\.|www\.)?google\.[a-z]{2,6}(?:\.[a-z]{2})?$/i;

function isAllowedGoogleMapsUrl(parsed: URL): boolean {
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return false;

  const host = parsed.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") {
    return parsed.pathname === "/maps" || parsed.pathname.startsWith("/maps/");
  }
  return GOOGLE_HOST_REGEX.test(host);
}

function extractCoordinatesFromHtml(html: string): { lat: number; lng: number } | null {
  const sample = html.slice(0, MAX_HTML_CHARS);

  // 1. Exact pin marker !3dLAT!4dLNG embedded inside Google Maps initial state
  const pinMatch = sample.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pinMatch) {
    const lat = Number.parseFloat(pinMatch[1]);
    const lng = Number.parseFloat(pinMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // 2. Meta preview staticmap center=LAT,LNG or center=LAT%2CLNG
  const centerMatch = sample.match(
    /center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i
  );
  if (centerMatch) {
    const lat = Number.parseFloat(centerMatch[1]);
    const lng = Number.parseFloat(centerMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // 3. Canonical @LAT,LNG in embedded URLs
  const atMatch = sample.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = Number.parseFloat(atMatch[1]);
    const lng = Number.parseFloat(atMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // 4. Escaped JSON coords [null,null,LAT,LNG] frequently emitted by Maps
  const arrayMatch = sample.match(/\[null,null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/);
  if (arrayMatch) {
    const lat = Number.parseFloat(arrayMatch[1]);
    const lng = Number.parseFloat(arrayMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  return null;
}

function extractPlaceLabel(urlStr: string, html?: string): string | null {
  const placeMatch = urlStr.match(/\/maps\/place\/([^/@?]+)/i);
  if (placeMatch?.[1]) {
    try {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
      if (decoded && decoded.toLowerCase() !== "google maps") {
        return decoded;
      }
    } catch {
      // ignore malformed encoding
    }
  }

  if (html) {
    const ogTitle = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    );
    const title = ogTitle?.[1]?.replace(/\s*·\s*Google Maps$/i, "").trim();
    if (title && !/^google maps$/i.test(title)) {
      return title;
    }
  }

  return null;
}

export async function POST(req: Request) {
  const originErr = verifySameOrigin(req);
  if (originErr) return originErr;

  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!rawUrl || rawUrl.length > 2048) {
      return NextResponse.json(
        { error: "Pega un enlace válido de Google Maps." },
        { status: 400 }
      );
    }

    // Fast path: full Google Maps URL already contains coordinates
    const direct = parseCoordinatesFromUrl(rawUrl);
    if (direct) {
      let parsedDirect: URL | null = null;
      try {
        parsedDirect = new URL(rawUrl);
      } catch {
        parsedDirect = null;
      }
      if (!parsedDirect || !isAllowedGoogleMapsUrl(parsedDirect)) {
        return NextResponse.json(
          {
            error:
              "Solo se admiten enlaces válidos de Google Maps (google.com/maps, maps.google.com, maps.app.goo.gl o goo.gl/maps).",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({
        lat: direct.lat,
        lng: direct.lng,
        resolvedUrl: rawUrl,
        canonicalUrl: buildGoogleMapsUrl(direct.lat, direct.lng),
        label: extractPlaceLabel(rawUrl),
      });
    }

    let currentUrl: URL;
    try {
      currentUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json(
        { error: "El texto pegado no es una URL válida. Debe comenzar con https://." },
        { status: 400 }
      );
    }

    if (!isAllowedGoogleMapsUrl(currentUrl)) {
      return NextResponse.json(
        {
          error:
            "Solo se admiten enlaces de Google Maps (google.com/maps, maps.google.com, maps.app.goo.gl o goo.gl/maps).",
        },
        { status: 400 }
      );
    }

    let finalUrl = currentUrl.toString();
    let htmlBody = "";

    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      const res = await fetch(currentUrl.toString(), {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ReservasApp/1.0; +https://cristianarando.dev)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) break;

        let nextUrl = new URL(location, currentUrl);

        // If routed via EU consent interstitial, unwrap the allowlisted Maps target
        if (nextUrl.hostname.toLowerCase() === "consent.google.com") {
          const cont = nextUrl.searchParams.get("continue");
          if (cont) {
            nextUrl = new URL(cont);
          }
        }

        if (!isAllowedGoogleMapsUrl(nextUrl)) {
          return NextResponse.json(
            {
              error:
                "El enlace acortado redirigió fuera de Google Maps y fue bloqueado por seguridad.",
            },
            { status: 400 }
          );
        }

        finalUrl = nextUrl.toString();
        const fromRedirect = parseCoordinatesFromUrl(finalUrl);
        if (fromRedirect) {
          return NextResponse.json({
            lat: fromRedirect.lat,
            lng: fromRedirect.lng,
            resolvedUrl: finalUrl,
            canonicalUrl: buildGoogleMapsUrl(fromRedirect.lat, fromRedirect.lng),
            label: extractPlaceLabel(finalUrl),
          });
        }

        currentUrl = nextUrl;
        continue;
      }

      if (res.ok) {
        htmlBody = await res.text();
      }
      break;
    }

    const fromFinalUrl = parseCoordinatesFromUrl(finalUrl);
    const coords = fromFinalUrl ?? (htmlBody ? extractCoordinatesFromHtml(htmlBody) : null);

    if (!coords) {
      return NextResponse.json(
        {
          error:
            "No pudimos extraer coordenadas de ese enlace de Google Maps. Intenta abrir el pin en Google Maps y copiar el enlace de compartir o el enlace largo con @lat,lng.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      lat: coords.lat,
      lng: coords.lng,
      resolvedUrl: finalUrl,
      canonicalUrl: buildGoogleMapsUrl(coords.lat, coords.lng),
      label: extractPlaceLabel(finalUrl, htmlBody),
    });
  } catch (error) {
    return safeErrorResponse(
      error,
      "No se pudo resolver el enlace de Google Maps."
    );
  }
}

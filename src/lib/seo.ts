import { cache } from "react";
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { parseCoordinatesFromUrl } from "@/lib/geo";

export interface SeoServiceItem {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
}

export interface SeoStaffItem {
  id: string;
  displayName: string;
  specialtyTitle: string;
}

export interface SeoHoursSpec {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

export interface SeoProfile {
  businessName: string;
  shortName: string;
  tagline: string;
  logoUrl: string | null;
  addressText: string;
  locality: string;
  countryCode: string;
  googleMapsUrl: string;
  coordinates: { lat: number; lng: number } | null;
  phoneWhatsapp: string;
  telephoneClean: string;
  currencySymbol: string;
  currencyCode: string;
  staffLabel: string;
  themePrimaryHex: string;
  themeSurfaceHex: string;
  schemaTypes: string[];
  category: string;
  seoTitle: string;
  seoDescription: string;
  ogTitle: string;
  ogDescription: string;
  keywords: string[];
  services: SeoServiceItem[];
  staff: SeoStaffItem[];
  openingHours: SeoHoursSpec[];
  updatedAtIso: string;
  versionTag: string;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const HOST_REGEX = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

function sanitizeHex(hex?: string | null, fallback = "#1F1F23"): string {
  if (!hex) return fallback;
  const trimmed = hex.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function resolveCurrencyCode(symbol?: string | null): string {
  const s = (symbol || "").trim().toUpperCase();
  if (s === "BS" || s === "BS.") return "BOB";
  if (s === "S/" || s === "PEN") return "PEN";
  if (s === "€" || s === "EUR") return "EUR";
  if (s === "MXN") return "MXN";
  if (s === "ARS") return "ARS";
  if (s === "CLP") return "CLP";
  if (s === "COP") return "COP";
  return "USD";
}

function inferSchemaMetadata(
  text: string
): { types: string[]; category: string; keywords: string[] } {
  const lower = text.toLowerCase();
  if (/(dental|odonto|dentist|sonrisa|ortodoncia|endodoncia|blanqueamiento)/.test(lower)) {
    return {
      types: ["Dentist", "MedicalBusiness"],
      category: "Salud y Odontología",
      keywords: [
        "clinica dental",
        "odontologia",
        "reservar cita dental",
        "dentista online",
        "agenda dental",
      ],
    };
  }
  if (/(barber|peluquer|salon|estilista|cabello|corte)/.test(lower)) {
    return {
      types: ["BeautySalon", "LocalBusiness"],
      category: "Belleza y Cuidado Personal",
      keywords: ["barberia", "salon", "reservar turno", "corte y cuidado", "agenda online"],
    };
  }
  if (/(estetica|spa|piel|facial|belleza|masaje)/.test(lower)) {
    return {
      types: ["HealthAndBeautyBusiness", "LocalBusiness"],
      category: "Estética y Bienestar",
      keywords: ["centro de estetica", "spa", "reservar cita estetica", "turnos online"],
    };
  }
  if (/(medic|clinic|consult|salud|doctor|pediatr|gineco|psicol|fisio)/.test(lower)) {
    return {
      types: ["MedicalClinic", "LocalBusiness"],
      category: "Salud y Consultorios",
      keywords: ["consultorio medico", "citas medicas online", "reservar turno", "clinica"],
    };
  }
  return {
    types: ["LocalBusiness", "ProfessionalService"],
    category: "Reservas y Servicios Profesionales",
    keywords: ["reservas online", "agendar cita", "turnos en tiempo real", "citas"],
  };
}

function buildShortName(name: string): string {
  const clean = name.trim();
  if (clean.length <= 14) return clean;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && `${words[0]} ${words[1]}`.length <= 15) {
    return `${words[0]} ${words[1]}`;
  }
  return clean.slice(0, 14).trim();
}

function extractLocationHints(addressText: string): {
  locality: string;
  countryCode: string;
} {
  const parts = addressText
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const lower = addressText.toLowerCase();
  let countryCode = "BO";
  if (/(mexico|cdmx|guadalajara|monterrey)/.test(lower)) countryCode = "MX";
  else if (/(argentina|buenos aires|cordoba)/.test(lower)) countryCode = "AR";
  else if (/(chile|santiago)/.test(lower)) countryCode = "CL";
  else if (/(peru|lima|arequipa)/.test(lower)) countryCode = "PE";
  else if (/(colombia|bogota|medellin)/.test(lower)) countryCode = "CO";
  else if (/(espana|españa|madrid|barcelona)/.test(lower)) countryCode = "ES";

  const locality =
    parts.length >= 3
      ? parts[parts.length - 2]
      : parts.length === 2
      ? parts[0]
      : addressText.trim() || "Cochabamba";

  return { locality, countryCode };
}

function buildOpeningHours(
  shifts: { dayOfWeek: number; startTime: string; endTime: string }[]
): SeoHoursSpec[] {
  if (!shifts.length) {
    return [
      {
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
      {
        dayOfWeek: ["Saturday"],
        opens: "09:00",
        closes: "13:00",
      },
    ];
  }

  const perDay = new Map<number, { opens: string; closes: string }>();
  for (const s of shifts) {
    if (s.dayOfWeek < 0 || s.dayOfWeek > 6) continue;
    const prev = perDay.get(s.dayOfWeek);
    if (!prev) {
      perDay.set(s.dayOfWeek, { opens: s.startTime, closes: s.endTime });
    } else {
      perDay.set(s.dayOfWeek, {
        opens: s.startTime < prev.opens ? s.startTime : prev.opens,
        closes: s.endTime > prev.closes ? s.endTime : prev.closes,
      });
    }
  }

  // Group days that share identical opens+closes bounds for clean Schema.org output
  const grouped = new Map<string, { dayOfWeek: string[]; opens: string; closes: string }>();
  for (const [dayIdx, window] of [...perDay.entries()].sort((a, b) => a[0] - b[0])) {
    const key = `${window.opens}-${window.closes}`;
    const existing = grouped.get(key);
    const dayName = DAY_NAMES[dayIdx];
    if (existing) {
      existing.dayOfWeek.push(dayName);
    } else {
      grouped.set(key, {
        dayOfWeek: [dayName],
        opens: window.opens,
        closes: window.closes,
      });
    }
  }

  return Array.from(grouped.values());
}

function truncateText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice = lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${safeSlice.replace(/[,;:\-.\s]+$/, "")}…`;
}

function fitServicesCopy(
  prefix: string,
  services: string[],
  suffix: string,
  maxLen: number
): string {
  for (let count = Math.min(3, services.length); count >= 1; count--) {
    const svcText = `Servicios: ${services.slice(0, count).join(", ")}.`;
    const candidate = `${prefix} ${svcText} ${suffix}`.replace(/\s+/g, " ").trim();
    if (candidate.length <= maxLen) return candidate;
  }
  const fallback = `${prefix} ${suffix}`.replace(/\s+/g, " ").trim();
  return truncateText(fallback, maxLen);
}

export async function resolveSiteUrl(): Promise<string> {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL;

  if (envUrl && envUrl.trim()) {
    try {
      const parsed = new URL(envUrl.trim());
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // Ignore invalid env URL and fall back to request headers
    }
  }

  try {
    const h = await headers();
    const rawHost = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
    if (rawHost && rawHost.length <= 253 && HOST_REGEX.test(rawHost)) {
      const rawProto = (h.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
      const isLocal =
        rawHost.startsWith("localhost") ||
        rawHost.startsWith("127.0.0.1") ||
        rawHost.startsWith("[::1]");
      const proto =
        rawProto === "http" || rawProto === "https"
          ? rawProto
          : isLocal
          ? "http"
          : "https";
      return `${proto}://${rawHost}`;
    }
  } catch {
    // headers() is unavailable outside a request context (e.g. build-time evaluation)
  }

  return "http://localhost:3000";
}

export const getSeoProfile = cache(async (): Promise<SeoProfile> => {
  let settings: Awaited<ReturnType<typeof prisma.businessSettings.findFirst>> = null;
  let services: SeoServiceItem[] = [];
  let staffRaw: {
    id: string;
    displayName: string;
    specialtyTitle: string;
    workingShifts: { dayOfWeek: number; startTime: string; endTime: string }[];
  }[] = [];

  try {
    const [settingsRow, serviceRows, staffRows] = await Promise.all([
      prisma.businessSettings.findFirst({ where: { id: 1 } }),
      prisma.service.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          durationMin: true,
          price: true,
        },
      }),
      prisma.staffProfile.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          displayName: true,
          specialtyTitle: true,
          workingShifts: {
            select: {
              dayOfWeek: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      }),
    ]);

    settings = settingsRow;
    services = serviceRows;
    staffRaw = staffRows;
  } catch (err) {
    console.warn("SEO fallback profile used:", err);
  }

  const businessName = settings?.name?.trim() || "Clínica Dental";
  const tagline =
    settings?.tagline?.trim() || "Reserva tu cita en línea en menos de 30 segundos";
  const addressText =
    settings?.addressText?.trim() || "Av. Simón López esq. Av. Beijing, Cochabamba, Bolivia";
  const googleMapsUrl =
    settings?.googleMapsUrl?.trim() ||
    "https://www.google.com/maps/search/?api=1&query=-17.3713,-66.1742";
  const coordinates = parseCoordinatesFromUrl(googleMapsUrl);
  const { locality, countryCode } = extractLocationHints(addressText);
  const phoneWhatsapp = settings?.phoneWhatsapp?.trim() || "+591 4 4450000";
  const telephoneClean = phoneWhatsapp.replace(/[^\d+]/g, "") || "+59144450000";
  const currencySymbol = settings?.currencySymbol?.trim() || "Bs";
  const currencyCode = resolveCurrencyCode(currencySymbol);
  const staffLabel = settings?.staffLabel?.trim() || "Doctor(a)";
  const themePrimaryHex = sanitizeHex(settings?.themePrimaryHex, "#1F1F23");
  const themeSurfaceHex = sanitizeHex(settings?.themeSurfaceHex, "#9FA0A6");

  const topServiceNames = services.slice(0, 4).map((s) => s.name);
  const inferred = inferSchemaMetadata(
    `${businessName} ${tagline} ${topServiceNames.join(" ")}`
  );

  const staff: SeoStaffItem[] = staffRaw.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    specialtyTitle: s.specialtyTitle,
  }));

  const openingHours = buildOpeningHours(
    staffRaw.flatMap((s) => s.workingShifts || [])
  );

  const seoTitle = truncateText(
    `${businessName} | Reserva tu Cita Online • ${locality}`,
    64
  );

  const seoDescription = fitServicesCopy(
    `${tagline}.`,
    topServiceNames,
    `Reserva en línea con confirmación inmediata en ${locality}.`,
    158
  );

  const ogTitle = truncateText(
    `${businessName} — Reserva tu Cita Online`,
    65
  );

  const ogDescription = fitServicesCopy(
    `${tagline}.`,
    topServiceNames,
    `Elige horario en tiempo real en ${locality}.`,
    155
  );

  const keywords = Array.from(
    new Set([
      businessName.toLowerCase(),
      `reservas ${locality.toLowerCase()}`,
      `citas online ${locality.toLowerCase()}`,
      ...inferred.keywords,
      ...topServiceNames.map((n) => n.toLowerCase()),
    ])
  );

  const updatedAtDate = settings?.updatedAt ?? new Date("2026-01-01T00:00:00.000Z");
  const versionTag = String(Math.floor(updatedAtDate.getTime() / 1000));

  return {
    businessName,
    shortName: buildShortName(businessName),
    tagline,
    logoUrl: settings?.logoUrl ?? null,
    addressText,
    locality,
    countryCode,
    googleMapsUrl,
    coordinates,
    phoneWhatsapp,
    telephoneClean,
    currencySymbol,
    currencyCode,
    staffLabel,
    themePrimaryHex,
    themeSurfaceHex,
    schemaTypes: inferred.types,
    category: inferred.category,
    seoTitle,
    seoDescription,
    ogTitle,
    ogDescription,
    keywords,
    services,
    staff,
    openingHours,
    updatedAtIso: updatedAtDate.toISOString(),
    versionTag,
  };
});

export function buildJsonLd(profile: SeoProfile, siteUrl: string) {
  const prices = profile.services
    .map((s) => Number(s.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const priceRange =
    minPrice !== null && maxPrice !== null
      ? `${profile.currencySymbol}${minPrice} - ${profile.currencySymbol}${maxPrice}`
      : undefined;

  const businessId = `${siteUrl}/#business`;
  const websiteId = `${siteUrl}/#website`;

  const businessNode: Record<string, unknown> = {
    "@type": profile.schemaTypes,
    "@id": businessId,
    name: profile.businessName,
    description: profile.seoDescription,
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/icon/512?v=${profile.versionTag}`,
      width: 512,
      height: 512,
    },
    image: `${siteUrl}/opengraph-image?v=${profile.versionTag}`,
    telephone: profile.telephoneClean,
    hasMap: profile.googleMapsUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: profile.addressText,
      addressLocality: profile.locality,
      addressCountry: profile.countryCode,
    },
    openingHoursSpecification: profile.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.dayOfWeek,
      opens: h.opens,
      closes: h.closes,
    })),
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: siteUrl,
        inLanguage: "es",
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: {
        "@type": "Reservation",
        name: `Cita en ${profile.businessName}`,
      },
    },
  };

  if (profile.coordinates) {
    businessNode.geo = {
      "@type": "GeoCoordinates",
      latitude: profile.coordinates.lat,
      longitude: profile.coordinates.lng,
    };
  }

  if (priceRange) {
    businessNode.priceRange = priceRange;
  }

  if (profile.services.length > 0) {
    businessNode.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `Servicios de ${profile.businessName}`,
      itemListElement: profile.services.map((svc) => ({
        "@type": "Offer",
        priceCurrency: profile.currencyCode,
        price: svc.price,
        itemOffered: {
          "@type": "Service",
          name: svc.name,
          description:
            svc.description || `Servicio profesional de ${svc.name} (${svc.durationMin} min).`,
        },
      })),
    };
  }

  if (profile.staff.length > 0) {
    businessNode.employee = profile.staff.map((st) => ({
      "@type": "Person",
      name: st.displayName,
      jobTitle: st.specialtyTitle,
    }));
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      businessNode,
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl,
        name: profile.businessName,
        description: profile.seoDescription,
        inLanguage: "es",
        publisher: {
          "@id": businessId,
        },
      },
    ],
  };
}

export async function resolveSatoriImageDataUri(
  rawUrl?: string | null
): Promise<string | null> {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/^data:image\/(?:png|jpeg|jpg);base64,/i.test(trimmed)) {
    return trimmed.length <= 2_500_000 ? trimmed : null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    let fetchUrl = trimmed;
    const parsed = new URL(trimmed);
    // Hint Unsplash/CDN to deliver JPEG rather than WebP so Satori renders reliably
    if (parsed.hostname.includes("images.unsplash.com") && !parsed.searchParams.has("fm")) {
      parsed.searchParams.set("fm", "jpg");
      fetchUrl = parsed.toString();
    }

    const res = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "image/png, image/jpeg, image/*;q=0.8" },
    });
    if (!res.ok) return null;

    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (ct !== "image/png" && ct !== "image/jpeg" && ct !== "image/jpg") {
      return null;
    }

    const arrBuf = await res.arrayBuffer();
    if (arrBuf.byteLength === 0 || arrBuf.byteLength > 2_000_000) return null;

    const b64 = Buffer.from(arrBuf).toString("base64");
    return `data:${ct === "image/jpg" ? "image/jpeg" : ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export interface LoadedSatoriFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal";
}

let cachedFontsPromise: Promise<LoadedSatoriFont[]> | null = null;

export async function loadSatoriFonts(): Promise<LoadedSatoriFont[]> {
  if (cachedFontsPromise) return cachedFontsPromise;

  cachedFontsPromise = (async () => {
    const fontsDir = join(process.cwd(), "src", "assets", "fonts");
    const specs: { file: string; weight: 400 | 600 | 700 }[] = [
      { file: "PlusJakartaSans-Regular.woff", weight: 400 },
      { file: "PlusJakartaSans-SemiBold.woff", weight: 600 },
      { file: "PlusJakartaSans-Bold.woff", weight: 700 },
    ];

    const loaded: LoadedSatoriFont[] = [];
    for (const spec of specs) {
      try {
        const data = await readFile(join(fontsDir, spec.file));
        loaded.push({
          name: "Plus Jakarta Sans",
          data,
          weight: spec.weight,
          style: "normal",
        });
      } catch {
        // Fallback smoothly if running from a test dir without bundled fonts
      }
    }
    return loaded;
  })();

  return cachedFontsPromise;
}

export function getBrandInitials(name: string): string {
  const words = name
    .replace(/^(clínica|clinica|consultorio|centro|dr\.|dra\.)\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "RC";
}

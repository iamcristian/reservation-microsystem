import { NextResponse } from "next/server";
import { requireAdmin, safeErrorResponse } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export interface GeocodeCandidate {
  lat: number;
  lng: number;
  label: string;
  shortName: string;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

const GEOCODER_HEADERS = {
  "User-Agent": "ReservasApp/1.0 (admin-location-picker)",
  "Accept": "application/json",
  "Accept-Language": "es,en;q=0.8",
};

function formatNominatimCandidate(item: NominatimResult): GeocodeCandidate | null {
  const lat = Number.parseFloat(String(item.lat ?? ""));
  const lng = Number.parseFloat(String(item.lon ?? ""));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const displayName = (item.display_name || "").trim();
  const addr = item.address || {};
  const street = addr.road || addr.pedestrian || addr.footway;
  const streetWithNum = street
    ? addr.house_number
      ? `${street} ${addr.house_number}`
      : street
    : "";
  const locality = addr.city || addr.town || addr.village || addr.municipality;
  const area = addr.neighbourhood || addr.suburb;

  const shortParts = [streetWithNum || displayName.split(",")[0]?.trim(), area, locality]
    .filter((v): v is string => Boolean(v && v.trim()))
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  return {
    lat,
    lng,
    label: displayName || shortParts.join(", "),
    shortName: shortParts.slice(0, 3).join(", ") || displayName,
  };
}

function formatPhotonCandidate(feature: PhotonFeature): GeocodeCandidate | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const props = feature.properties || {};
  const streetLine = [props.street || props.name, props.housenumber]
    .filter(Boolean)
    .join(" ")
    .trim();
  const shortParts = [streetLine || props.name, props.district, props.city]
    .filter((v): v is string => Boolean(v && v.trim()))
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
  const fullParts = [...shortParts, props.state, props.country]
    .filter((v): v is string => Boolean(v && v.trim()))
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  if (fullParts.length === 0) return null;

  return {
    lat,
    lng,
    label: fullParts.join(", "),
    shortName: shortParts.slice(0, 3).join(", ") || fullParts.join(", "),
  };
}

async function queryNominatim(query: string): Promise<GeocodeCandidate[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: GEOCODER_HEADERS,
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => formatNominatimCandidate(item as NominatimResult))
    .filter((c): c is GeocodeCandidate => c !== null);
}

async function queryPhoton(query: string): Promise<GeocodeCandidate[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url, {
    headers: { "User-Agent": GEOCODER_HEADERS["User-Agent"], Accept: "application/json" },
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: unknown[] };
  if (!Array.isArray(data?.features)) return [];
  return data.features
    .map((f) => formatPhotonCandidate(f as PhotonFeature))
    .filter((c): c is GeocodeCandidate => c !== null);
}

function dedupeCandidates(items: GeocodeCandidate[]): GeocodeCandidate[] {
  const out: GeocodeCandidate[] = [];
  for (const item of items) {
    const duplicate = out.some(
      (existing) =>
        Math.abs(existing.lat - item.lat) < 0.00015 &&
        Math.abs(existing.lng - item.lng) < 0.00015
    );
    if (!duplicate) out.push(item);
    if (out.length >= 5) break;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const rawQuery = (searchParams.get("q") || "").trim();
    if (rawQuery.length < 2) {
      return NextResponse.json(
        { error: "Ingresa al menos 2 caracteres para buscar." },
        { status: 400 }
      );
    }
    const query = rawQuery.slice(0, 200);

    let candidates: GeocodeCandidate[] = [];
    try {
      candidates = await queryNominatim(query);
      if (candidates.length === 0 && !/,/.test(query) && !/bolivia/i.test(query)) {
        candidates = await queryNominatim(`${query}, Bolivia`);
      }
    } catch {
      candidates = [];
    }

    if (candidates.length === 0) {
      try {
        candidates = await queryPhoton(query);
      } catch {
        candidates = [];
      }
    }

    return NextResponse.json({
      results: dedupeCandidates(candidates),
    });
  } catch (error) {
    return safeErrorResponse(error, "No se pudo buscar la dirección.");
  }
}

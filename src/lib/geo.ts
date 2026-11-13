export function isValidCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function parseCoordinatesFromUrl(
  url?: string | null
): { lat: number; lng: number } | null {
  if (!url || typeof url !== "string") return null;

  // 1. Exact pin marker inside Google Maps place URLs (!3dLAT!4dLNG)
  const bangMatch = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    const lat = parseFloat(bangMatch[1]);
    const lng = parseFloat(bangMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // 2. query=LAT,LNG | q=LAT,LNG | ll=LAT,LNG | center=LAT,LNG
  const queryMatch = url.match(
    /[?&](?:query|q|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i
  );
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // 3. @LAT,LNG viewport/place coordinates
  const atMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  return null;
}

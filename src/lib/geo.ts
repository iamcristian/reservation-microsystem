export function parseCoordinatesFromUrl(
  url?: string | null
): { lat: number; lng: number } | null {
  if (!url) return null;
  // Match query=LAT,LNG or q=LAT,LNG
  const queryMatch = url.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  // Match @LAT,LNG
  const atMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  return null;
}

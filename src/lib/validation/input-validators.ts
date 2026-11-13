// src/lib/validation/input-validators.ts

export const VALID_APPOINTMENT_STATUSES = [
  "CONFIRMED",
  "RESCHEDULED_BY_STAFF",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatus = (typeof VALID_APPOINTMENT_STATUSES)[number];

const ALLOWED_DATA_IMAGE_MIME =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Validates and sanitizes an image URL or base64 Data URL.
 * Rejects javascript:, data:text/html, SVG scripts, and oversized payloads.
 */
export function sanitizeImageOrDataUrl(
  value: unknown,
  maxBytes = 550_000
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Formato de imagen inválido." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (trimmed.length > maxBytes) {
    return {
      ok: false,
      error: "La imagen excede el tamaño máximo permitido (550 KB). Reduce o comprime la imagen.",
    };
  }

  if (trimmed.startsWith("data:")) {
    if (!ALLOWED_DATA_IMAGE_MIME.test(trimmed)) {
      return {
        ok: false,
        error: "Formato de imagen Data URL no permitido. Usa PNG, JPG, WEBP o GIF.",
      };
    }
    return { ok: true, value: trimmed };
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (/[\r\n<>"'`]/.test(trimmed)) {
      return { ok: false, error: "Ruta de imagen inválida." };
    }
    return { ok: true, value: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Solo se permiten URLs de imagen http:// o https://." };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: "URL de imagen inválida." };
  }
}

/**
 * Validates an external link (e.g., Google Maps URL). Only allows http:// or https://.
 * Prevents Stored XSS via javascript:, data:, or vbscript: URIs.
 */
export function sanitizeHttpUrl(
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Enlace inválido." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: "" };
  }
  if (trimmed.length > 2048) {
    return { ok: false, error: "La URL excede el largo máximo permitido." };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Solo se permiten enlaces http:// o https://." };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: "URL inválida. Debe comenzar con https:// o http://." };
  }
}

/**
 * Clamps a numeric input into a safe integer range, returning fallback when invalid.
 */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

/**
 * Validates #RRGGBB hex colors and returns fallback if malformed.
 */
export function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

/**
 * Normalizes and trims email strings consistently.
 */
export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

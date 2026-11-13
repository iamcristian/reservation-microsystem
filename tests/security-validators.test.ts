// tests/security-validators.test.ts
import {
  clampInt,
  normalizeEmail,
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizeImageOrDataUrl,
  VALID_APPOINTMENT_STATUSES,
} from "../src/lib/validation/input-validators";
import { parseCoordinatesFromUrl } from "../src/lib/geo";
import { buildWhatsAppUrl, cleanPhoneForWhatsApp } from "../src/lib/whatsapp";
import { describeTimeOffBlock, isTimeOffOnDate } from "../src/lib/timeoff-utils";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name} ${detail ? `- ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log("AUTOMATED SECURITY & UTILITY TESTS");
console.log("=======================================================\n");

// 1. Image & Data URL sanitization
assert(
  sanitizeImageOrDataUrl("javascript:alert(1)").ok === false,
  "Blocks javascript: URI in image field"
);
assert(
  sanitizeImageOrDataUrl("data:text/html,<script>alert(1)</script>").ok === false,
  "Blocks data:text/html XSS in image field"
);
assert(
  sanitizeImageOrDataUrl("data:image/svg+xml;base64,PHN2Zz4=").ok === false,
  "Blocks SVG data URLs with embedded script capability"
);
assert(
  sanitizeImageOrDataUrl("data:image/png;base64,iVBORw0KGgoAAAANS").ok === true,
  "Allows legitimate PNG data URL"
);
assert(
  sanitizeImageOrDataUrl("https://cdn.example.com/logo.webp").ok === true,
  "Allows legitimate HTTPS image URL"
);
assert(
  sanitizeImageOrDataUrl("/icons/logo.png").ok === true,
  "Allows safe relative path image"
);
assert(
  sanitizeImageOrDataUrl("https://evil.com/" + "a".repeat(600_000)).ok === false,
  "Blocks oversized image payloads (>550KB)"
);

// 2. External URL sanitization (e.g. googleMapsUrl)
assert(
  sanitizeHttpUrl("javascript:alert(document.cookie)").ok === false,
  "Blocks javascript: in googleMapsUrl"
);
assert(
  sanitizeHttpUrl("https://www.google.com/maps/search/?api=1&query=-17.3713,-66.1742").ok === true,
  "Allows valid HTTPS Google Maps URL"
);

// 3. Numeric clamping, Hex validation & Email normalization
assert(clampInt(-50, 1, 90, 7) === 1, "Clamps negative bookingHorizonDays to min=1");
assert(clampInt(999999, 1, 90, 7) === 90, "Clamps huge bookingHorizonDays to max=90");
assert(clampInt("not-a-number", 1, 90, 7) === 7, "Returns fallback on NaN numeric input");
assert(sanitizeHexColor("#1f1f23", "#000000") === "#1F1F23", "Normalizes valid hex color");
assert(sanitizeHexColor("red; background:url(x)", "#1F1F23") === "#1F1F23", "Rejects malformed CSS injection in hex field");
assert(normalizeEmail("  User@Example.COM ") === "user@example.com", "Normalizes whitespace & casing on email");
assert(VALID_APPOINTMENT_STATUSES.includes("NO_SHOW"), "Includes valid appointment statuses");

// 4. Geo & WhatsApp utilities
const coords = parseCoordinatesFromUrl(
  "https://www.google.com/maps/search/?api=1&query=-16.5000,-68.1500"
);
assert(
  coords !== null && coords.lat === -16.5 && coords.lng === -68.15,
  "Parses dynamic clinic coordinates from googleMapsUrl"
);
const pinFirstCoords = parseCoordinatesFromUrl(
  "https://www.google.com/maps/place/Mi+Local/@-17.3900,-66.1500,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-17.37125!4d-66.17425"
);
assert(
  pinFirstCoords !== null &&
    pinFirstCoords.lat === -17.37125 &&
    pinFirstCoords.lng === -66.17425,
  "Prioritizes exact !3d!4d pin coordinates over @ viewport center"
);
const llCoords = parseCoordinatesFromUrl(
  "https://maps.google.com/?ll=-17.7833,-63.1821&z=16"
);
assert(
  llCoords !== null && llCoords.lat === -17.7833 && llCoords.lng === -63.1821,
  "Parses ll= Google Maps parameter"
);
const encodedCenterCoords = parseCoordinatesFromUrl(
  "https://maps.google.com/maps/api/staticmap?center=-17.3713%2C-66.1742&zoom=15"
);
assert(
  encodedCenterCoords !== null &&
    encodedCenterCoords.lat === -17.3713 &&
    encodedCenterCoords.lng === -66.1742,
  "Parses URL-encoded center= Google Maps parameter"
);
const viewportAtCoords = parseCoordinatesFromUrl(
  "https://www.google.com/maps/@-17.38123,-66.16543,18z"
);
assert(
  viewportAtCoords !== null &&
    viewportAtCoords.lat === -17.38123 &&
    viewportAtCoords.lng === -66.16543,
  "Parses @lat,lng Google Maps viewport link"
);
assert(
  parseCoordinatesFromUrl("https://www.google.com/maps?q=95.0,-66.1") === null &&
    parseCoordinatesFromUrl("https://www.google.com/maps?q=0,0") === null,
  "Rejects out-of-range or null-island coordinates"
);
assert(cleanPhoneForWhatsApp("+591 700-12345") === "59170012345", "Strips formatting from phone");
assert(
  buildWhatsAppUrl("+591 70012345", "Hola mundo") ===
    "https://wa.me/59170012345?text=Hola%20mundo",
  "Builds properly encoded WhatsApp deep link"
);

// TimeOff UTC-vs-local boundary isolation (Bolivia UTC-4 Saturday block must not bleed into Sunday)
const satUtc4Block = {
  type: "FULL_DAY_OFF",
  reason: "Cerrado el 2026-11-14 por descanso/imprevisto",
  startAt: "2026-11-14T04:00:00.000Z",
  endAt: "2026-11-15T03:59:59.000Z",
};
assert(
  isTimeOffOnDate(satUtc4Block, "2026-11-14") === true,
  "Matches FULL_DAY_OFF block on its target date (Saturday 14)"
);
assert(
  isTimeOffOnDate(satUtc4Block, "2026-11-15") === false,
  "Does NOT bleed UTC-4 FULL_DAY_OFF block into next calendar date (Sunday 15)"
);
const satInfo = describeTimeOffBlock(satUtc4Block);
assert(
  satInfo.periodLabel.includes("14") && !satInfo.periodLabel.includes("15"),
  "Formats FULL_DAY_OFF periodLabel anchored cleanly to day 14"
);

console.log(`\nSecurity & Utility Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}

// src/lib/date-utils.ts

/**
 * Returns date formatted as YYYY-MM-DD in the user's local timezone.
 * IMPORTANT: Never use toISOString().split("T")[0] for booking calendar dates,
 * because toISOString converts to UTC and shifts to tomorrow's date during evening hours.
 */
export function formatLocalDateYYYYMMDD(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// src/lib/date-utils.ts

/**
 * Retorna la fecha en formato YYYY-MM-DD en la zona horaria local.
 * IMPORTANTE: Nunca usar toISOString().split("T")[0] para fechas de agenda
 * porque toISOString convierte a UTC y después de las 20:00 (en UTC-4) cambia al día de mañana.
 */
export function formatLocalDateYYYYMMDD(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

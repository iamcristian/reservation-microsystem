// src/lib/validation/acceptance-criteria.ts
/**
 * CRITERIOS DE ACEPTACIÓN DEL SISTEMA DE RESERVAS & HORARIOS
 * 
 * Reglas de negocio e invariantes estrictas para evitar turnos imposibles,
 * solapamientos de agenda, inconsistencias temporales y reservas fantasmas.
 */

export interface ShiftItem {
  id?: string;
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  startTime: string; // "HH:mm" (24h)
  endTime: string;   // "HH:mm" (24h)
}

export interface ShiftValidationError {
  dayOfWeek: number;
  shiftIndex?: number;
  type: "INVALID_TIME_FORMAT" | "INVERTED_TIMES" | "MIN_DURATION" | "OVERLAP" | "MAX_SHIFTS" | "INVALID_DAY";
  message: string;
}

export interface ShiftValidationResult {
  isValid: boolean;
  errors: ShiftValidationError[];
  dayErrors: Record<number, string[]>;
}

// Criterio AC-SHIFT-01: Formato HH:mm estricto 00:00 a 23:59
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convierte "HH:mm" a minutos transcurridos desde medianoche (0 - 1439).
 * Retorna -1 si el formato es inválido.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string" || !TIME_REGEX.test(timeStr)) {
    return -1;
  }
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convierte minutos desde medianoche a formato "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, minutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Valida un turno individual.
 * Criterios de Aceptación:
 * - AC-SHIFT-01: Hora con formato válido HH:mm.
 * - AC-SHIFT-02: startTime < endTime (Estrictamente cronológico, nunca invertido ni igual).
 * - AC-SHIFT-03: Duración mínima (por defecto 30 minutos).
 */
export function validateSingleShift(
  shift: ShiftItem,
  minDurationMin = 30
): { isValid: boolean; error?: ShiftValidationError } {
  // AC-SHIFT-06: Día válido
  if (typeof shift.dayOfWeek !== "number" || shift.dayOfWeek < 0 || shift.dayOfWeek > 6) {
    return {
      isValid: false,
      error: {
        dayOfWeek: shift.dayOfWeek,
        type: "INVALID_DAY",
        message: `El día de la semana (${shift.dayOfWeek}) es inválido (debe ser 0-6).`,
      },
    };
  }

  // AC-SHIFT-01: Formato de hora
  const startMin = timeToMinutes(shift.startTime);
  const endMin = timeToMinutes(shift.endTime);

  if (startMin === -1 || endMin === -1) {
    return {
      isValid: false,
      error: {
        dayOfWeek: shift.dayOfWeek,
        type: "INVALID_TIME_FORMAT",
        message: `El formato de hora debe ser HH:mm válido (recibido: ${shift.startTime} - ${shift.endTime}).`,
      },
    };
  }

  // AC-SHIFT-02: La hora de inicio NO puede ser igual o posterior a la de fin
  if (startMin >= endMin) {
    return {
      isValid: false,
      error: {
        dayOfWeek: shift.dayOfWeek,
        type: "INVERTED_TIMES",
        message: `Horario imposible: La hora de inicio (${shift.startTime}) no puede ser igual o posterior a la hora de fin (${shift.endTime}).`,
      },
    };
  }

  // AC-SHIFT-03: Duración mínima
  const duration = endMin - startMin;
  if (duration < minDurationMin) {
    return {
      isValid: false,
      error: {
        dayOfWeek: shift.dayOfWeek,
        type: "MIN_DURATION",
        message: `El turno de ${shift.startTime} a ${shift.endTime} dura solo ${duration} min. La duración mínima es de ${minDurationMin} minutos.`,
      },
    };
  }

  return { isValid: true };
}

/**
 * Valida todos los turnos pertenecientes a un día específico.
 * Criterios de Aceptación:
 * - AC-SHIFT-04: Máximo 3 turnos por día.
 * - AC-SHIFT-05: Sin solapamiento (Overlap) entre turnos del mismo día.
 */
export function validateDayShifts(
  dayOfWeek: number,
  shifts: ShiftItem[],
  maxShiftsPerDay = 3,
  minDurationMin = 30
): ShiftValidationError[] {
  const errors: ShiftValidationError[] = [];
  const dayName = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][dayOfWeek] || `Día ${dayOfWeek}`;

  // Si no hay turnos, el día está cerrado (completamente válido)
  if (!shifts || shifts.length === 0) {
    return errors;
  }

  // AC-SHIFT-04: Límite de turnos diarios
  if (shifts.length > maxShiftsPerDay) {
    errors.push({
      dayOfWeek,
      type: "MAX_SHIFTS",
      message: `${dayName}: Máximo ${maxShiftsPerDay} turnos permitidos por día (actualmente tiene ${shifts.length}).`,
    });
  }

  // Validar cada turno individualmente
  shifts.forEach((shift, index) => {
    const singleValidation = validateSingleShift(shift, minDurationMin);
    if (!singleValidation.isValid && singleValidation.error) {
      errors.push({
        ...singleValidation.error,
        shiftIndex: index,
        message: `${dayName} - Turno ${index + 1}: ${singleValidation.error.message}`,
      });
    }
  });

  // AC-SHIFT-05: Detección de solapamiento entre turnos
  // Convertimos a intervalos con minutos para verificar choques
  const parsedIntervals = shifts.map((s, idx) => ({
    idx,
    startTime: s.startTime,
    endTime: s.endTime,
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime),
  }));

  for (let i = 0; i < parsedIntervals.length; i++) {
    for (let j = i + 1; j < parsedIntervals.length; j++) {
      const a = parsedIntervals[i];
      const b = parsedIntervals[j];

      // Omitir si alguno tiene tiempos corruptos ya reportados
      if (a.start === -1 || a.end === -1 || a.start >= a.end) continue;
      if (b.start === -1 || b.end === -1 || b.start >= b.end) continue;

      // Condición de colisión/solapamiento: a.start < b.end && a.end > b.start
      const hasOverlap = a.start < b.end && a.end > b.start;

      if (hasOverlap) {
        errors.push({
          dayOfWeek,
          shiftIndex: j,
          type: "OVERLAP",
          message: `${dayName}: Solapamiento detectado entre Turno ${a.idx + 1} (${a.startTime} - ${a.endTime}) y Turno ${b.idx + 1} (${b.startTime} - ${b.endTime}). Los horarios de un mismo día deben ser continuos o separados.`,
        });
      }
    }
  }

  return errors;
}

/**
 * Valida la lista completa de turnos semanales de un profesional.
 */
export function validateAllShifts(
  shifts: ShiftItem[],
  options: { maxShiftsPerDay?: number; minDurationMin?: number } = {}
): ShiftValidationResult {
  const maxShiftsPerDay = options.maxShiftsPerDay ?? 3;
  const minDurationMin = options.minDurationMin ?? 30;

  const errors: ShiftValidationError[] = [];
  const dayErrors: Record<number, string[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
  };

  // Agrupar por día
  for (let day = 0; day <= 6; day++) {
    const dayShifts = shifts.filter((s) => s.dayOfWeek === day);
    const dayValidationErrors = validateDayShifts(day, dayShifts, maxShiftsPerDay, minDurationMin);

    if (dayValidationErrors.length > 0) {
      errors.push(...dayValidationErrors);
      dayErrors[day] = dayValidationErrors.map((e) => e.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    dayErrors,
  };
}

/**
 * Limpia y ordena los turnos de manera segura:
 * - Ordena por día (1 a 6, luego 0) y por hora de inicio cronológica.
 */
export function sanitizeAndSortShifts(shifts: ShiftItem[]): ShiftItem[] {
  return [...shifts].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek;
    }
    const aMin = timeToMinutes(a.startTime);
    const bMin = timeToMinutes(b.startTime);
    return aMin - bMin;
  });
}

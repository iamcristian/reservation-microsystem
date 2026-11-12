// src/lib/validation/acceptance-criteria.ts
import { formatLocalDateYYYYMMDD } from "../date-utils";

/**
 * BUSINESS ACCEPTANCE CRITERIA FOR SHIFTS & SCHEDULES
 * 
 * Strict domain invariants preventing impossible working hours, schedule overlaps,
 * temporal discrepancies, and ghost appointments.
 */

export interface ShiftItem {
  id?: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
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

// Criterion AC-SHIFT-01: Strict HH:mm format 00:00 to 23:59
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Converts "HH:mm" to elapsed minutes since midnight (0 - 1439).
 * Returns -1 if the format is invalid.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string" || !TIME_REGEX.test(timeStr)) {
    return -1;
  }
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts minutes since midnight back to "HH:mm" format.
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, minutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Validates an individual shift item.
 * Acceptance Criteria:
 * - AC-SHIFT-01: Valid HH:mm time format.
 * - AC-SHIFT-02: startTime < endTime (Strictly chronological, never inverted or zero).
 * - AC-SHIFT-03: Minimum duration (default: 30 minutes).
 */
export function validateSingleShift(
  shift: ShiftItem,
  minDurationMin = 30
): { isValid: boolean; error?: ShiftValidationError } {
  // AC-SHIFT-06: Valid day of week
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

  // AC-SHIFT-01: Time format
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

  // AC-SHIFT-02: Start time CANNOT be equal to or later than end time
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

  // AC-SHIFT-03: Minimum duration
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
 * Validates all shifts belonging to a specific day of the week.
 * Acceptance Criteria:
 * - AC-SHIFT-04: Maximum 3 shifts per day.
 * - AC-SHIFT-05: Zero overlap between shifts on the same day.
 */
export function validateDayShifts(
  dayOfWeek: number,
  shifts: ShiftItem[],
  maxShiftsPerDay = 3,
  minDurationMin = 30
): ShiftValidationError[] {
  const errors: ShiftValidationError[] = [];
  const dayName = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][dayOfWeek] || `Día ${dayOfWeek}`;

  // If no shifts are defined, the day is closed (completely valid)
  if (!shifts || shifts.length === 0) {
    return errors;
  }

  // AC-SHIFT-04: Daily shift count limit
  if (shifts.length > maxShiftsPerDay) {
    errors.push({
      dayOfWeek,
      type: "MAX_SHIFTS",
      message: `${dayName}: Máximo ${maxShiftsPerDay} turnos permitidos por día (actualmente tiene ${shifts.length}).`,
    });
  }

  // Validate each shift individually
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

  // AC-SHIFT-05: Overlap detection between shifts
  // Map intervals with minutes to inspect collisions
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

      // Skip if either interval contains corrupted times already reported
      if (a.start === -1 || a.end === -1 || a.start >= a.end) continue;
      if (b.start === -1 || b.end === -1 || b.start >= b.end) continue;

      // Overlap condition: a.start < b.end && a.end > b.start
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
 * Validates the full weekly working shift schedule for a staff member.
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

  // Group by day of week
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
 * Safely sanitizes and sorts shifts:
 * - Orders by day (0 to 6) and by chronological start time.
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

export interface OverrideStaffTarget {
  displayName: string;
  isActive?: boolean;
  workingShifts: ShiftItem[];
}

export interface DayScheduleStatus {
  hasShiftsOnDay: boolean;
  isPastDate: boolean;
  isToday: boolean;
  isDayClosedAlready: boolean;
  earliestStartMin: number;
  latestEndMin: number;
  earliestStartStr: string;
  latestEndStr: string;
  reason?: string;
}

const WEEKDAY_NAMES_PLURAL = [
  "domingos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
];

/**
 * Evaluates whether a target doctor (or the entire clinic) still has open working
 * hours remaining on `dateStr` relative to `now`.
 */
export function getDayScheduleStatus(params: {
  dateStr: string;
  targets: OverrideStaffTarget[];
  isAllTargets?: boolean;
  now?: Date;
}): DayScheduleStatus {
  const { dateStr, targets, isAllTargets = false } = params;
  const now = params.now ?? new Date();
  const todayStr = formatLocalDateYYYYMMDD(now);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      hasShiftsOnDay: false,
      isPastDate: false,
      isToday: false,
      isDayClosedAlready: true,
      earliestStartMin: -1,
      latestEndMin: -1,
      earliestStartStr: "",
      latestEndStr: "",
      reason: "Formato de fecha inválido.",
    };
  }

  const isToday = dateStr === todayStr;
  const isPastDate = dateStr < todayStr;
  if (isPastDate) {
    return {
      hasShiftsOnDay: false,
      isPastDate: true,
      isToday: false,
      isDayClosedAlready: true,
      earliestStartMin: -1,
      latestEndMin: -1,
      earliestStartStr: "",
      latestEndStr: "",
      reason: `La fecha seleccionada (${dateStr}) ya pasó. Selecciona hoy o un día futuro.`,
    };
  }

  const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
  const activeTargets = targets.filter((t) => t.isActive !== false);
  const shiftsOnDay = activeTargets.flatMap((t) =>
    (t.workingShifts || []).filter((s) => {
      if (s.dayOfWeek !== dayOfWeek) return false;
      const startMin = timeToMinutes(s.startTime);
      const endMin = timeToMinutes(s.endTime);
      return startMin !== -1 && endMin > startMin;
    })
  );

  if (shiftsOnDay.length === 0) {
    const dayLabel = WEEKDAY_NAMES_PLURAL[dayOfWeek] || "ese día";
    const subject = isAllTargets
      ? "Ningún profesional atiende"
      : `${targets[0]?.displayName || "El profesional"} no atiende`;
    return {
      hasShiftsOnDay: false,
      isPastDate: false,
      isToday,
      isDayClosedAlready: true,
      earliestStartMin: -1,
      latestEndMin: -1,
      earliestStartStr: "",
      latestEndStr: "",
      reason: `${subject} los ${dayLabel} (${dateStr}). La agenda ya está cerrada ese día.`,
    };
  }

  const startMins = shiftsOnDay.map((s) => timeToMinutes(s.startTime));
  const endMins = shiftsOnDay.map((s) => timeToMinutes(s.endTime));
  const earliestStartMin = Math.min(...startMins);
  const latestEndMin = Math.max(...endMins);
  const earliestStartStr = minutesToTime(earliestStartMin);
  const latestEndStr = minutesToTime(latestEndMin);

  if (isToday) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowStr = minutesToTime(nowMin);
    if (nowMin >= latestEndMin) {
      const subject = isAllTargets
        ? "Todo el equipo ya cerró"
        : `${targets[0]?.displayName || "El profesional"} ya cerró`;
      return {
        hasShiftsOnDay: true,
        isPastDate: false,
        isToday: true,
        isDayClosedAlready: true,
        earliestStartMin,
        latestEndMin,
        earliestStartStr,
        latestEndStr,
        reason: `${subject} su atención hoy (${earliestStartStr} - ${latestEndStr}) a las ${latestEndStr} (ahora son las ${nowStr}).`,
      };
    }
  }

  return {
    hasShiftsOnDay: true,
    isPastDate: false,
    isToday,
    isDayClosedAlready: false,
    earliestStartMin,
    latestEndMin,
    earliestStartStr,
    latestEndStr,
  };
}

/**
 * Returns a sensible default "HH:mm" cutoff time within an open schedule window.
 */
export function getSuggestedOverrideTime(
  type: "LATE_START" | "EARLY_LEAVE" | "FULL_DAY_OFF",
  status: DayScheduleStatus,
  now: Date = new Date()
): string {
  if (type === "FULL_DAY_OFF") return "00:00";
  if (!status.hasShiftsOnDay || status.isDayClosedAlready) {
    return type === "LATE_START"
      ? status.earliestStartStr || "09:30"
      : status.latestEndStr || "16:00";
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const minValid = Math.max(
    status.earliestStartMin + 15,
    status.isToday ? Math.ceil((nowMin + 15) / 15) * 15 : 0
  );
  const maxValid = status.latestEndMin - 15;

  if (type === "EARLY_LEAVE") {
    const preferred = status.latestEndMin - 60;
    const clamped = Math.max(minValid, Math.min(maxValid, preferred));
    return minutesToTime(
      Math.min(status.latestEndMin - 1, Math.max(status.earliestStartMin + 1, clamped))
    );
  }

  // LATE_START
  const preferred = Math.max(status.earliestStartMin + 60, minValid);
  const clamped = Math.min(maxValid, preferred);
  return minutesToTime(
    Math.min(status.latestEndMin - 1, Math.max(status.earliestStartMin + 1, clamped))
  );
}

/**
 * Validates that a single-day schedule override (LATE_START, EARLY_LEAVE, FULL_DAY_OFF)
 * targets an active future/remaining shift and obeys chronological bounds.
 */
export function validateScheduleOverride(params: {
  type: "LATE_START" | "EARLY_LEAVE" | "FULL_DAY_OFF" | string;
  dateStr: string;
  timeStr?: string;
  targets: OverrideStaffTarget[];
  isAllTargets?: boolean;
  now?: Date;
}): { valid: boolean; error?: string; status: DayScheduleStatus } {
  const now = params.now ?? new Date();
  const status = getDayScheduleStatus({
    dateStr: params.dateStr,
    targets: params.targets,
    isAllTargets: params.isAllTargets,
    now,
  });

  if (status.isDayClosedAlready) {
    return { valid: false, error: status.reason, status };
  }

  if (params.type === "FULL_DAY_OFF") {
    return { valid: true, status };
  }

  const chosenMin = timeToMinutes(params.timeStr || "");
  if (chosenMin === -1) {
    return {
      valid: false,
      error: "Ingresa una hora válida en formato HH:mm.",
      status,
    };
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowStr = minutesToTime(nowMin);

  if (params.type === "EARLY_LEAVE") {
    if (status.isToday && chosenMin <= nowMin) {
      return {
        valid: false,
        error: `La hora de cierre (${params.timeStr}) ya pasó (son las ${nowStr}). Selecciona una hora posterior.`,
        status,
      };
    }
    if (chosenMin >= status.latestEndMin) {
      return {
        valid: false,
        error: `La hora de salida anticipada (${params.timeStr}) debe ser anterior al cierre normal (${status.latestEndStr}).`,
        status,
      };
    }
    if (chosenMin <= status.earliestStartMin) {
      return {
        valid: false,
        error: `La hora de cierre (${params.timeStr}) es igual o anterior al inicio (${status.earliestStartStr}). Usa "Cerrar día completo".`,
        status,
      };
    }
    return { valid: true, status };
  }

  if (params.type === "LATE_START") {
    if (status.isToday && chosenMin <= nowMin) {
      return {
        valid: false,
        error: `La hora de llegada (${params.timeStr}) ya pasó (son las ${nowStr}).`,
        status,
      };
    }
    if (chosenMin >= status.latestEndMin) {
      return {
        valid: false,
        error: `La hora de llegada (${params.timeStr}) es igual o posterior al cierre (${status.latestEndStr}). Usa "Cerrar día completo".`,
        status,
      };
    }
    if (chosenMin <= status.earliestStartMin) {
      return {
        valid: false,
        error: `La atención ya inicia a las ${status.earliestStartStr}. Elige una hora posterior para entrar más tarde.`,
        status,
      };
    }
    return { valid: true, status };
  }

  return { valid: true, status };
}

// src/lib/slot-engine.ts

export interface WorkingShiftModel {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface TimeOffModel {
  id: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  type?: string;
  reason?: string | null;
}

export interface AppointmentModel {
  id: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  status: string;
}

export interface SlotEngineParams {
  dateStr: string; // "YYYY-MM-DD"
  shifts: WorkingShiftModel[];
  timeOffs: TimeOffModel[];
  appointments: AppointmentModel[];
  serviceDuration: number; // in minutes (duration + buffer)
  slotStepMin: number;     // e.g. 30 min
  leadTimeMin: number;     // e.g. 15 or 30 min
  now?: Date;
}

export function parseDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  // Using local time representation
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function formatLocalDateYYYYMMDD(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimeHHmm(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function computeAvailableSlotsForStaff({
  dateStr,
  shifts,
  timeOffs,
  appointments,
  serviceDuration,
  slotStepMin,
  leadTimeMin,
  now = new Date(),
}: SlotEngineParams): string[] {
  const slots: string[] = [];
  const minAllowedStart = new Date(now.getTime() + leadTimeMin * 60_000);

  // Filter busy intervals for this date
  const busyIntervals = [
    ...timeOffs.map((t) => ({
      start: new Date(t.startAt).getTime(),
      end: new Date(t.endAt).getTime(),
    })),
    ...appointments
      .filter((a) => a.status === "CONFIRMED" || a.status === "RESCHEDULED_BY_STAFF")
      .map((a) => ({
        start: new Date(a.startAt).getTime(),
        end: new Date(a.endAt).getTime(),
      })),
  ];

  for (const shift of shifts) {
    const shiftStart = parseDateAndTime(dateStr, shift.startTime);
    let shiftEnd = parseDateAndTime(dateStr, shift.endTime);

    // Invariante AC-SHIFT-02: La hora de inicio debe ser estrictamente menor a la hora de fin.
    // Turnos invertidos (ej. 20:00 a 19:00) o nulos (14:00 a 14:00) son inválidos y no deben generar slots.
    if (shiftEnd.getTime() <= shiftStart.getTime()) {
      continue;
    }

    let cursor = shiftStart.getTime();
    const durationMs = serviceDuration * 60_000;
    const stepMs = Math.max(15, slotStepMin) * 60_000;

    while (cursor + durationMs <= shiftEnd.getTime()) {
      const candidateStart = cursor;
      const candidateEnd = cursor + durationMs;

      // 1. Lead time check (e.g. don't book if start is less than leadTimeMin from now)
      const respectsLeadTime = candidateStart >= minAllowedStart.getTime();

      // 2. Overlap check with existing appointments or time-offs
      const hasOverlap = busyIntervals.some(
        (busy) => candidateStart < busy.end && candidateEnd > busy.start
      );

      if (respectsLeadTime && !hasOverlap) {
        slots.push(formatTimeHHmm(new Date(candidateStart)));
      }
      cursor += stepMs;
    }
  }

  return Array.from(new Set(slots)).sort();
}

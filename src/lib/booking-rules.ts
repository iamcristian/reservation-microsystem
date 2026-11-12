// src/lib/booking-rules.ts

export interface AppointmentCheckable {
  id: string;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
  allowFreeCancel: boolean;
  staffMoveReason?: string | null;
}

const ACTIVE_BOOKING_STATUSES = new Set(["CONFIRMED", "RESCHEDULED_BY_STAFF"]);

export function isActiveBookingStatus(status: string): boolean {
  return ACTIVE_BOOKING_STATUSES.has(status);
}

/**
 * Active reservations only count from present/in-progress to the future (endAt > now),
 * so past appointments never consume customer quota even if staff forgot to tick them.
 */
export function isUpcomingActiveAppointment(
  appointment: Pick<AppointmentCheckable, "status" | "startAt" | "endAt">,
  now = new Date()
): boolean {
  if (!isActiveBookingStatus(appointment.status)) return false;
  const endMs = new Date(appointment.endAt || appointment.startAt).getTime();
  return !Number.isNaN(endMs) && endMs > now.getTime();
}

export function isPastUntickedAppointment(
  appointment: Pick<AppointmentCheckable, "status" | "startAt" | "endAt">,
  now = new Date()
): boolean {
  if (!isActiveBookingStatus(appointment.status)) return false;
  const endMs = new Date(appointment.endAt || appointment.startAt).getTime();
  return !Number.isNaN(endMs) && endMs <= now.getTime();
}

export function canCustomerCancelAppointment(
  appointment: AppointmentCheckable,
  minCancelNoticeHours: number,
  now = new Date()
): { allowed: boolean; reason?: string; isFreeCancellationBecauseOfStaff?: boolean } {
  if (appointment.status === "CANCELLED") {
    return { allowed: false, reason: "La cita ya se encuentra cancelada." };
  }
  if (appointment.status === "COMPLETED") {
    return { allowed: false, reason: "La cita ya fue completada." };
  }

  const nowMs = now.getTime();
  const endMs = new Date(appointment.endAt || appointment.startAt).getTime();
  if (!Number.isNaN(endMs) && endMs <= nowMs) {
    return { allowed: false, reason: "Esta cita ya finalizó y pasó a tu historial." };
  }

  // KEY EXCEPTION: If the specialist rescheduled the appointment due to an unforeseen event, customer can ALWAYS cancel for free
  if (appointment.allowFreeCancel || appointment.status === "RESCHEDULED_BY_STAFF") {
    return {
      allowed: true,
      isFreeCancellationBecauseOfStaff: true,
    };
  }

  const startMs = new Date(appointment.startAt).getTime();
  const hoursRemaining = (startMs - nowMs) / (1000 * 60 * 60);

  if (hoursRemaining < minCancelNoticeHours) {
    return {
      allowed: false,
      reason: `No es posible cancelar con menos de ${minCancelNoticeHours} horas de anticipación. Por favor comunícate directamente por WhatsApp si tienes una urgencia.`,
    };
  }

  return { allowed: true };
}

export function findConflictingAppointments(
  appointments: AppointmentCheckable[],
  blockStart: Date,
  blockEnd: Date
): AppointmentCheckable[] {
  const bStart = blockStart.getTime();
  const bEnd = blockEnd.getTime();

  return appointments.filter((apt) => {
    if (apt.status === "CANCELLED" || apt.status === "COMPLETED") return false;
    const aStart = new Date(apt.startAt).getTime();
    const aEnd = new Date(apt.endAt).getTime();
    // Overlap condition
    return aStart < bEnd && aEnd > bStart;
  });
}

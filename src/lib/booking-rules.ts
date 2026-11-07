// src/lib/booking-rules.ts

export interface AppointmentCheckable {
  id: string;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
  allowFreeCancel: boolean;
  staffMoveReason?: string | null;
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

  // EXCEPCIÓN CLAVE: Si el profesional movió la cita por un imprevisto, el cliente SIEMPRE puede cancelar
  if (appointment.allowFreeCancel || appointment.status === "RESCHEDULED_BY_STAFF") {
    return {
      allowed: true,
      isFreeCancellationBecauseOfStaff: true,
    };
  }

  const startMs = new Date(appointment.startAt).getTime();
  const nowMs = now.getTime();
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

// src/lib/whatsapp.ts

/**
 * Strips all non-numeric characters so phone strings work safely inside wa.me URLs.
 */
export function cleanPhoneForWhatsApp(phone?: string | null): string {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Builds a plain or prefilled wa.me link. Returns "#" if the phone has no digits.
 */
export function buildWhatsAppUrl(phone?: string | null, message?: string): string {
  const digits = cleanPhoneForWhatsApp(phone);
  if (!digits) return "#";
  if (!message) return `https://wa.me/${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Formats an appointment date + time in Spanish for patient WhatsApp templates.
 */
function formatAppointmentDateTimeEs(startAt: string | Date) {
  const dt = new Date(startAt);
  return {
    dateFormatted: dt.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    timeFormatted: dt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function buildCustomerCancellationWhatsAppUrl(
  apt: {
    startAt: string | Date;
    customer?: { name?: string | null; phone?: string | null } | null;
    staff?: { displayName?: string | null } | null;
    service?: { name?: string | null } | null;
  },
  businessName?: string | null
): string {
  const { dateFormatted, timeFormatted } = formatAppointmentDateTimeEs(apt.startAt);
  const text = `Hola ${apt.customer?.name || ""}, te escribe ${businessName || "la clínica"} (${
    apt.staff?.displayName || "el profesional"
  }).

Lamentamos informarte que tuvimos que cancelar tu cita de *${
    apt.service?.name || "servicio"
  }* programada para el *${dateFormatted}* a las *${timeFormatted}* debido a un imprevisto / ajuste de agenda.

Disculpa los inconvenientes ocasionados. Puedes ingresar a la app para seleccionar un nuevo horario disponible cuando gustes o responder directamente a este mensaje para coordinar.`;

  return buildWhatsAppUrl(apt.customer?.phone, text);
}

export function buildCustomerNoShowWhatsAppUrl(
  apt: {
    startAt: string | Date;
    customer?: { name?: string | null; phone?: string | null } | null;
    staff?: { displayName?: string | null } | null;
    service?: { name?: string | null } | null;
  },
  businessName?: string | null
): string {
  const { dateFormatted, timeFormatted } = formatAppointmentDateTimeEs(apt.startAt);
  const text = `Hola ${apt.customer?.name || ""}, te escribe ${
    businessName || "el consultorio"
  } (${apt.staff?.displayName || "el profesional"}).

Te esperábamos para tu cita de *${
    apt.service?.name || "servicio"
  }* reservada para el *${dateFormatted}* a las *${timeFormatted}*, pero notamos que no pudiste presentarte.

¿Te encuentras bien o tuviste algún inconveniente? Si deseas reprogramar, por favor comunícate por este medio. Recuerda avisar con anticipación para liberar el turno a otros pacientes. ¡Buen día!`;

  return buildWhatsAppUrl(apt.customer?.phone, text);
}

export function buildStaffInviteWhatsAppUrl(
  staff: {
    displayName: string;
    specialty?: string | null;
    specialtyTitle?: string | null;
    user?: { email?: string | null; phone?: string | null } | null;
  },
  businessPhone?: string | null,
  businessName?: string | null,
  appUrl = "https://clinica.app"
): string {
  const phone = staff.user?.phone || businessPhone;
  const staffEmail = staff.user?.email || "tu correo de Google";
  const specialty = staff.specialtyTitle || staff.specialty || "Especialista";
  const text = `Hola *${staff.displayName}*, te damos la bienvenida al equipo de *${
    businessName || "nuestra clínica"
  }* 👋.

Ya habilitamos tu cuenta de profesional en nuestro sistema de citas online:
🔗 *Enlace de acceso:* ${appUrl}
📧 *Cuenta Google autorizada:* ${staffEmail}
🩺 *Rol asignado:* Profesional / Especialista (${specialty})

Al ingresar con tu correo de Google podrás:
✅ Ver y gestionar tus citas del día (marcar atendidas, faltas o avisar por WhatsApp).
✅ Configurar tus horarios semanales y bloquear imprevistos (entrar más tarde, salir antes o cerrar día).`;

  return buildWhatsAppUrl(phone, text);
}

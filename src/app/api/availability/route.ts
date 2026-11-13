// src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeAvailableSlotsForStaff,
  formatLocalDateYYYYMMDD,
  parseDateAndTime,
} from "@/lib/slot-engine";
import {
  AvailabilityUnavailableReason,
  PublicTimeOffNotice,
  WEEKDAY_NAMES_PLURAL,
} from "@/lib/timeoff-utils";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function buildUnavailableReason(params: {
  dateStr: string;
  dayOfWeek: number;
  isSingleStaff: boolean;
  singleStaffName?: string;
  dayTimeOffNotices: PublicTimeOffNotice[];
  anyWithinHorizon: boolean;
  anyHasShiftOnWeekday: boolean;
  anyHasAppointmentOverlap: boolean;
  maxHorizon: number;
}): AvailabilityUnavailableReason {
  const {
    dateStr,
    dayOfWeek,
    isSingleStaff,
    singleStaffName,
    dayTimeOffNotices,
    anyWithinHorizon,
    anyHasShiftOnWeekday,
    anyHasAppointmentOverlap,
    maxHorizon,
  } = params;

  const subject = singleStaffName || "El profesional";

  const vacationBlocks = dayTimeOffNotices.filter((b) => b.type === "VACATION");
  if (vacationBlocks.length > 0) {
    return {
      code: "VACATION",
      title: isSingleStaff
        ? `${subject} se encuentra de vacaciones`
        : "Personal de vacaciones en esta fecha",
      description: isSingleStaff
        ? "Tiene un periodo de vacaciones o receso agendado en esta fecha. Por favor elige otro día disponible en el calendario."
        : "No hay turnos disponibles por vacaciones programadas en esta fecha. Por favor elige otro día disponible en el calendario.",
      blocks: vacationBlocks,
    };
  }

  const fullDayBlocks = dayTimeOffNotices.filter((b) => {
    if (b.type === "FULL_DAY_OFF") return true;
    const s = new Date(b.startAt);
    const e = new Date(b.endAt);
    return s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() >= 23 && e.getMinutes() >= 58;
  });
  if (fullDayBlocks.length > 0) {
    return {
      code: "FULL_DAY_OFF",
      title: isSingleStaff
        ? `${subject} no atiende en esta fecha`
        : "Agenda cerrada en esta fecha",
      description:
        "Se programó un cierre de agenda para este día. Por favor selecciona otra fecha disponible en el calendario.",
      blocks: fullDayBlocks,
    };
  }

  if (dayTimeOffNotices.length > 0) {
    return {
      code: "TIME_OFF_BLOCKED",
      title: isSingleStaff
        ? `Agenda con bloqueo horario (${subject})`
        : "Horarios bloqueados en esta fecha",
      description:
        "Los turnos de esta fecha quedaron cubiertos por bloqueos programados o reservas previas. Por favor elige otra fecha disponible en el calendario.",
      blocks: dayTimeOffNotices,
    };
  }

  if (!anyWithinHorizon) {
    return {
      code: "OUTSIDE_HORIZON",
      title: "Fecha fuera del rango habilitado",
      description: `Se habilitan reservas hasta con ${maxHorizon} días de anticipación. Por favor elige una fecha más cercana.`,
    };
  }

  if (!anyHasShiftOnWeekday) {
    const weekdayPlural = WEEKDAY_NAMES_PLURAL[dayOfWeek] || "esa fecha";
    return {
      code: "NO_WORKING_SHIFT",
      title: "Sin cupos disponibles en esta fecha.",
      description: isSingleStaff
        ? `${subject} no tiene atención regular programada los ${weekdayPlural}. Por favor elige otra fecha disponible en el calendario.`
        : `No hay atención regular programada los ${weekdayPlural}. Por favor elige otra fecha disponible en el calendario.`,
    };
  }

  if (dateStr === formatLocalDateYYYYMMDD(new Date())) {
    return {
      code: "TODAY_EXHAUSTED",
      title: "No quedan horarios disponibles para hoy.",
      description:
        "El horario de atención ha finalizado o los cupos de hoy están completos. Selecciona mañana u otra fecha en el calendario.",
    };
  }

  if (anyHasAppointmentOverlap) {
    return {
      code: "ALL_BOOKED",
      title: "Sin cupos disponibles en esta fecha.",
      description:
        "Todos los turnos de este día ya están reservados. Por favor elige otra fecha disponible en el calendario.",
    };
  }

  return {
    code: "NO_SLOTS",
    title: "Sin cupos disponibles en esta fecha.",
    description:
      "No hay turnos libres para este día. Por favor elige otra fecha disponible en el calendario.",
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");
    const staffId = searchParams.get("staffId") || "ANY";
    const dateStr = searchParams.get("date"); // "YYYY-MM-DD"

    if (!serviceId || !dateStr) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos: serviceId y date" },
        { status: 400 }
      );
    }

    const settings = await prisma.businessSettings.findFirst({ where: { id: 1 } });
    const service = await prisma.service.findUnique({ where: { id: serviceId } });

    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
    }

    // Validate base date
    const requestedDate = new Date(`${dateStr}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0 || diffDays > 90) {
      return NextResponse.json(
        {
          slots: [],
          slotStaffMapping: {},
          timeOffNotices: [],
          unavailableReason: {
            code: "OUTSIDE_HORIZON",
            title: "Fecha fuera del rango permitido",
            description: "La fecha seleccionada está fuera del rango permitido para reservas.",
          },
          message: "La fecha seleccionada está fuera del rango permitido.",
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Determine Day of Week (0 = Domingo, 1 = Lunes ... 6 = Sábado)
    const dayOfWeek = requestedDate.getDay();

    // Query candidates
    let eligibleStaffIds: string[] = [];

    const staffServices = await prisma.staffService.findMany({
      where: {
        serviceId,
        staff: { isActive: true },
      },
      select: { staffId: true },
    });
    const assignedActiveStaffIds = staffServices.map((s) => s.staffId);

    if (staffId === "ANY") {
      eligibleStaffIds = assignedActiveStaffIds;
    } else {
      if (assignedActiveStaffIds.includes(staffId)) {
        eligibleStaffIds = [staffId];
      } else {
        const totalAssignedCount = await prisma.staffService.count({ where: { serviceId } });
        eligibleStaffIds = totalAssignedCount === 0 ? [staffId] : [];
      }
    }

    if (eligibleStaffIds.length === 0) {
      let unavailableReason: AvailabilityUnavailableReason = {
        code: "NO_SLOTS",
        title: "Sin cupos disponibles en esta fecha.",
        description:
          "No hay especialistas activos habilitados para realizar este servicio en este momento.",
      };

      if (staffId !== "ANY") {
        const requestedStaff = await prisma.staffProfile.findUnique({
          where: { id: staffId },
          select: { displayName: true, isActive: true },
        });
        if (requestedStaff && !requestedStaff.isActive) {
          unavailableReason = {
            code: "STAFF_PAUSED",
            title: `${requestedStaff.displayName} pausó temporalmente su agenda`,
            description:
              "Este profesional se encuentra en modo vacaciones o pausa inmediata. Elige otro especialista o consulta por WhatsApp.",
          };
        }
      }

      return NextResponse.json(
        {
          slots: [],
          slotStaffMapping: {},
          timeOffNotices: [],
          unavailableReason,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Query shifts, timeOffs, appointments, and candidate staff profiles for that date range
    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999`);
    // Also include morning of next day in case shift goes past midnight
    const nextMorning = new Date(endOfDay.getTime() + 6 * 60 * 60 * 1000);

    const [staffProfiles, shifts, timeOffs, appointments] = await Promise.all([
      prisma.staffProfile.findMany({
        where: { id: { in: eligibleStaffIds } },
      }),
      prisma.workingShift.findMany({
        where: {
          staffId: { in: eligibleStaffIds },
          dayOfWeek,
        },
      }),
      prisma.timeOff.findMany({
        where: {
          staffId: { in: eligibleStaffIds },
          startAt: { lte: nextMorning },
          endAt: { gte: startOfDay },
        },
        orderBy: { startAt: "asc" },
      }),
      prisma.appointment.findMany({
        where: {
          staffId: { in: eligibleStaffIds },
          startAt: { lte: nextMorning },
          endAt: { gte: startOfDay },
          status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
        },
      }),
    ]);

    const staffMap = new Map(staffProfiles.map((p) => [p.id, p]));
    const totalServiceDuration = service.durationMin + service.bufferAfterMin;
    const slotStep = settings?.slotStepMin ?? 30;
    const isSingleStaff = staffId !== "ANY";

    // Collect slots and metadata across all eligible staff
    const allSlotsMap = new Map<string, string[]>(); // slotTime -> array of staffIds available
    const dayTimeOffNotices: PublicTimeOffNotice[] = [];
    let anyWithinHorizon = false;
    let anyHasShiftOnWeekday = false;
    let anyHasAppointmentOverlap = false;
    let maxHorizon = settings?.bookingHorizonDays ?? 7;
    let pausedSingleStaffName: string | undefined;

    for (const sId of eligibleStaffIds) {
      const staffProfile = staffMap.get(sId);
      if (!staffProfile) continue;
      if (!staffProfile.isActive) {
        if (isSingleStaff) pausedSingleStaffName = staffProfile.displayName;
        continue;
      }

      const staffHorizon =
        staffProfile.customHorizonDays ?? settings?.bookingHorizonDays ?? 7;
      if (staffHorizon > maxHorizon) maxHorizon = staffHorizon;
      if (diffDays > staffHorizon) continue;
      anyWithinHorizon = true;

      const staffShifts = shifts.filter((s) => s.staffId === sId);
      const hasValidShift = staffShifts.some(
        (s) =>
          parseDateAndTime(dateStr, s.endTime).getTime() >
          parseDateAndTime(dateStr, s.startTime).getTime()
      );
      if (hasValidShift) anyHasShiftOnWeekday = true;

      const staffTimeOffs = timeOffs.filter((t) => t.staffId === sId);
      const staffDayTimeOffs = staffTimeOffs.filter(
        (t) => t.startAt <= endOfDay && t.endAt >= startOfDay
      );
      for (const t of staffDayTimeOffs) {
        dayTimeOffNotices.push({
          id: t.id,
          staffId: t.staffId,
          staffName: staffProfile.displayName,
          type: t.type,
          reason: t.reason,
          startAt: t.startAt.toISOString(),
          endAt: t.endAt.toISOString(),
        });
      }

      const staffAppointments = appointments.filter((a) => a.staffId === sId);
      if (staffAppointments.length > 0) anyHasAppointmentOverlap = true;

      const staffLeadTime =
        staffProfile.customLeadTimeMin ?? settings?.minLeadTimeMinutes ?? 30;

      const availableForStaff = computeAvailableSlotsForStaff({
        dateStr,
        shifts: staffShifts,
        timeOffs: staffTimeOffs,
        appointments: staffAppointments,
        serviceDuration: totalServiceDuration,
        slotStepMin: slotStep,
        leadTimeMin: staffLeadTime,
        now: new Date(),
      });

      for (const time of availableForStaff) {
        const current = allSlotsMap.get(time) || [];
        current.push(sId);
        allSlotsMap.set(time, current);
      }
    }

    const sortedSlots = Array.from(allSlotsMap.keys()).sort();
    const unavailableReason: AvailabilityUnavailableReason | null =
      sortedSlots.length === 0
        ? pausedSingleStaffName && dayTimeOffNotices.length === 0
          ? {
              code: "STAFF_PAUSED",
              title: `${pausedSingleStaffName} pausó temporalmente su agenda`,
              description:
                "Este profesional se encuentra en modo vacaciones o pausa inmediata. Elige otro especialista o consulta por WhatsApp.",
            }
          : buildUnavailableReason({
              dateStr,
              dayOfWeek,
              isSingleStaff,
              singleStaffName: isSingleStaff
                ? staffMap.get(staffId)?.displayName
                : undefined,
              dayTimeOffNotices,
              anyWithinHorizon,
              anyHasShiftOnWeekday,
              anyHasAppointmentOverlap,
              maxHorizon,
            })
        : null;

    return NextResponse.json(
      {
        date: dateStr,
        service,
        slots: sortedSlots,
        slotStaffMapping: Object.fromEntries(allSlotsMap),
        timeOffNotices: dayTimeOffNotices,
        unavailableReason,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("Availability error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

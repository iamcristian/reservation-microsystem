// src/app/api/admin/day-override/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatLocalDateYYYYMMDD } from "@/lib/date-utils";
import { formatTimeHHmm } from "@/lib/slot-engine";
import {
  validateScheduleOverride,
  validateVacationRange,
} from "@/lib/validation/acceptance-criteria";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "PROVIDER")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { staffId, type, startAt, endAt, reason, resolution } = await req.json();

    if (!staffId || !startAt || !endAt) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (staffId, startAt, endAt)" },
        { status: 400 }
      );
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return NextResponse.json(
        { error: "El rango horario del bloqueo es inválido." },
        { status: 400 }
      );
    }

    if (user.role === "PROVIDER") {
      const ownStaff = await prisma.staffProfile.findFirst({
        where: { userId: user.id },
      });
      if (!ownStaff || ownStaff.id !== staffId) {
        return NextResponse.json(
          { error: "Solo puedes gestionar bloqueos y cierres sobre tu propia agenda." },
          { status: 403 }
        );
      }
    }

    const targetStaffRecords = await prisma.staffProfile.findMany({
      where: staffId === "ALL" ? { isActive: true } : { id: staffId },
      include: { workingShifts: true, timeOffs: true },
    });

    if (targetStaffRecords.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron profesionales activos para aplicar el bloqueo." },
        { status: 404 }
      );
    }

    const targetStaffIds = targetStaffRecords.map((s) => s.id);
    const now = new Date();

    // Enforce temporal & state invariants: disallow overrides on vacations, closed days, paused staff, non-working days, or past dates
    if (type === "VACATION") {
      if (endDate <= now) {
        return NextResponse.json(
          { error: "No es posible programar vacaciones en fechas pasadas." },
          { status: 400 }
        );
      }
      const vacValidation = validateVacationRange({
        startDate: formatLocalDateYYYYMMDD(startDate),
        endDate: formatLocalDateYYYYMMDD(endDate),
        targets: targetStaffRecords,
        now,
      });
      if (!vacValidation.valid) {
        return NextResponse.json(
          { error: vacValidation.error },
          { status: 400 }
        );
      }
    } else if (type === "LATE_START" || type === "EARLY_LEAVE" || type === "FULL_DAY_OFF") {
      const dateStr = formatLocalDateYYYYMMDD(startDate);
      const timeStr =
        type === "EARLY_LEAVE"
          ? formatTimeHHmm(startDate)
          : type === "LATE_START"
          ? formatTimeHHmm(endDate)
          : undefined;
      const overrideValidation = validateScheduleOverride({
        type,
        dateStr,
        timeStr,
        targets: targetStaffRecords,
        isAllTargets: staffId === "ALL",
        now,
      });

      if (!overrideValidation.valid) {
        return NextResponse.json(
          { error: overrideValidation.error },
          { status: 400 }
        );
      }
    }

    // 1. Detect conflicting appointments
    const conflicting = await prisma.appointment.findMany({
      where: {
        staffId: { in: targetStaffIds },
        status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
        startAt: { lt: endDate },
        endAt: { gt: startDate },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        service: true,
        staff: true,
      },
    });

    // If conflicts exist and doctor has not chosen resolution yet, return conflict details
    if (conflicting.length > 0 && !resolution) {
      return NextResponse.json({
        hasConflicts: true,
        message: `Existen ${conflicting.length} cita(s) agendada(s) en este horario.`,
        affectedAppointments: conflicting,
      });
    }

    // 2. Apply Resolution if conflicts exist
    if (conflicting.length > 0 && resolution) {
      if (resolution === "MOVE_TO_END") {
        // Invariant: Appointments cannot be moved to end of day if full day is closed, vacation, or early departure (endAt = 23:59:59)
        if (type === "FULL_DAY_OFF" || type === "VACATION" || type === "EARLY_LEAVE" || endDate.getHours() >= 22) {
          return NextResponse.json(
            {
              error:
                "No es posible mover citas para después del bloqueo cuando se cierra la jornada o son vacaciones. Selecciona cancelar las citas afectadas.",
            },
            { status: 400 }
          );
        }

        // Load other active appointments on the same day after the block to avoid double-booking
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        const remainingDayApts = await prisma.appointment.findMany({
          where: {
            staffId: { in: targetStaffIds },
            id: { notIn: conflicting.map((c) => c.id) },
            status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
            startAt: { gte: endDate, lte: endOfDay },
          },
          orderBy: { startAt: "asc" },
        });

        let cursor = new Date(endDate);
        const occupiedIntervals = remainingDayApts.map((a) => ({
          start: new Date(a.startAt).getTime(),
          end: new Date(a.endAt).getTime(),
        }));

        for (const apt of conflicting) {
          const durationMs = (apt.service.durationMin + apt.service.bufferAfterMin) * 60_000;
          // Advance cursor past any overlapping existing appointment
          let hasCollision = true;
          while (hasCollision) {
            const candidateStart = cursor.getTime();
            const candidateEnd = candidateStart + durationMs;
            const colliding = occupiedIntervals.find(
              (occ) => candidateStart < occ.end && candidateEnd > occ.start
            );
            if (colliding) {
              cursor = new Date(colliding.end);
            } else {
              hasCollision = false;
            }
          }

          const newStart = new Date(cursor);
          const newEnd = new Date(cursor.getTime() + durationMs);
          occupiedIntervals.push({ start: newStart.getTime(), end: newEnd.getTime() });

          await prisma.appointment.update({
            where: { id: apt.id },
            data: {
              previousStartAt: apt.startAt,
              startAt: newStart,
              endAt: newEnd,
              status: "RESCHEDULED_BY_STAFF",
              allowFreeCancel: true,
              staffMoveReason: reason || "Imprevisto de agenda del profesional",
            },
          });

          // Create notification for customer
          await prisma.notification.create({
            data: {
              userId: apt.customerId,
              appointmentId: apt.id,
              type: "APPOINTMENT_MOVED",
              title: "Tu cita fue reprogramada por el profesional",
              message: `El ${apt.staff.displayName} reprogramó tu cita para el ${newStart.toLocaleDateString()} a las ${newStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${reason || "Imprevisto"}). Puedes confirmarla o cancelarla sin penalización.`,
            },
          });

          cursor = newEnd;
        }
      } else if (resolution === "CANCEL_ALL") {
        for (const apt of conflicting) {
          await prisma.appointment.update({
            where: { id: apt.id },
            data: {
              status: "CANCELLED",
              staffMoveReason: reason || "Cancelada por imprevisto del profesional",
            },
          });

          const aptDate = new Date(apt.startAt);
          const timeFormatted = aptDate.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const dateFormatted = aptDate.toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "short",
          });
          const serviceName = apt.service?.name || "Servicio";

          await prisma.notification.create({
            data: {
              userId: apt.customerId,
              appointmentId: apt.id,
              type: "APPOINTMENT_CANCELLED",
              title: `Se canceló tu cita de las ${timeFormatted} (${serviceName})`,
              message: `Tu cita de ${serviceName} del ${dateFormatted} a las ${timeFormatted} con ${apt.staff.displayName} tuvo que cancelarse debido a: "${reason || "Imprevisto personal"}". Por favor agenda un nuevo horario cuando desees.`,
            },
          });
        }
      }
    }

    // 3. Save TimeOff record (clean up prior redundant blocks for this staff on the target window)
    if (type === "FULL_DAY_OFF" || type === "VACATION") {
      await prisma.timeOff.deleteMany({
        where: {
          staffId: { in: targetStaffIds },
          type: { not: "VACATION" },
          startAt: { gte: startDate },
          endAt: { lte: endDate },
        },
      });
    } else if (type === "LATE_START" || type === "EARLY_LEAVE") {
      const dayStr = formatLocalDateYYYYMMDD(startDate);
      const dayStartBound = new Date(`${dayStr}T00:00:00`);
      const dayEndBound = new Date(`${dayStr}T23:59:59.999`);
      await prisma.timeOff.deleteMany({
        where: {
          staffId: { in: targetStaffIds },
          type,
          startAt: { gte: dayStartBound },
          endAt: { lte: dayEndBound },
        },
      });
    }

    const createdTimeOffs = [];
    for (const tStaffId of targetStaffIds) {
      const created = await prisma.timeOff.create({
        data: {
          staffId: tStaffId,
          startAt: startDate,
          endAt: endDate,
          type: type || "CUSTOM_BLOCK",
          reason: reason || null,
        },
      });
      createdTimeOffs.push(created);
    }

    return NextResponse.json({
      ok: true,
      timeOff: createdTimeOffs[0] || null,
      timeOffs: createdTimeOffs,
      conflictsResolved: conflicting.length,
    });
  } catch (error: unknown) {
    console.error("Day override error:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "PROVIDER")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Falta el parámetro id del bloqueo (TimeOff)" },
        { status: 400 }
      );
    }

    const existing = await prisma.timeOff.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Bloqueo no encontrado" }, { status: 404 });
    }

    // Role check: PROVIDER can only delete their own TimeOff blocks
    if (user.role === "PROVIDER") {
      const ownStaff = await prisma.staffProfile.findFirst({
        where: { userId: user.id },
      });
      if (!ownStaff || ownStaff.id !== existing.staffId) {
        return NextResponse.json(
          { error: "Solo puedes eliminar tus propios bloqueos de horario." },
          { status: 403 }
        );
      }
    }

    await prisma.timeOff.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Delete day override error:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// src/app/api/admin/appointments/[id]/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireStaffOrAdmin,
  safeErrorResponse,
  sanitizeUserForClient,
  verifyProviderOwnsStaff,
  verifySameOrigin,
} from "@/lib/api-guard";
import { VALID_APPOINTMENT_STATUSES } from "@/lib/validation/input-validators";
import { emitRealtimeEvent } from "@/lib/realtime-events";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireStaffOrAdmin();
    if (auth.error) return auth.error;
    const { user } = auth;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, reason, blockCustomer } = body;

    if (
      typeof status !== "string" ||
      !(VALID_APPOINTMENT_STATUSES as readonly string[]).includes(status)
    ) {
      return NextResponse.json(
        { error: "Estado de cita inválido." },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { customer: true, service: true, staff: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const ownershipErr = await verifyProviderOwnsStaff(user, appointment.staffId);
    if (ownershipErr) return ownershipErr;

    const cleanReason =
      typeof reason === "string" ? reason.trim().slice(0, 300) : undefined;
    const effectiveReason =
      status === "CANCELLED"
        ? cleanReason || "Cancelada por el profesional / imprevisto de agenda"
        : cleanReason;

    const previousStatus = appointment.status;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status,
          ...(effectiveReason ? { staffMoveReason: effectiveReason } : {}),
        },
      });

      let finalCustomer = appointment.customer;

      if (status === "CANCELLED" && previousStatus !== "CANCELLED") {
        const aptDate = new Date(appointment.startAt);
        const timeFormatted = aptDate.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const dateFormatted = aptDate.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "short",
        });
        const serviceName = appointment.service?.name || "Servicio";

        await tx.notification.create({
          data: {
            userId: appointment.customerId,
            appointmentId: appointment.id,
            type: "APPOINTMENT_CANCELLED",
            title: `Se canceló tu cita de las ${timeFormatted} (${serviceName})`,
            message: `Tu cita de ${serviceName} del ${dateFormatted} a las ${timeFormatted} con ${
              appointment.staff?.displayName || "el profesional"
            } fue cancelada: "${
              cleanReason || "Imprevisto de agenda"
            }". Puedes agendar un nuevo horario cuando desees.`,
          },
        });
      }

      // Idempotent counter deltas: only adjust when actually transitioning in or out of COMPLETED / NO_SHOW
      let completedDelta = 0;
      if (previousStatus !== "COMPLETED" && status === "COMPLETED") {
        completedDelta = 1;
      } else if (previousStatus === "COMPLETED" && status !== "COMPLETED") {
        completedDelta = -1;
      }

      let noShowDelta = 0;
      if (previousStatus !== "NO_SHOW" && status === "NO_SHOW") {
        noShowDelta = 1;
      } else if (previousStatus === "NO_SHOW" && status !== "NO_SHOW") {
        noShowDelta = -1;
      }

      const nextCompleted = Math.max(
        0,
        finalCustomer.completedCount + completedDelta
      );
      const nextNoShow = Math.max(0, finalCustomer.noShowCount + noShowDelta);

      const canModifyBlock = user.role === "ADMIN" || status === "NO_SHOW";
      let nextBlocked = finalCustomer.isBlocked;
      if (status === "NO_SHOW") {
        if (blockCustomer || nextNoShow >= 2) {
          nextBlocked = true;
        }
      } else if (canModifyBlock && blockCustomer !== undefined) {
        nextBlocked = Boolean(blockCustomer);
      }

      if (
        nextCompleted !== finalCustomer.completedCount ||
        nextNoShow !== finalCustomer.noShowCount ||
        nextBlocked !== finalCustomer.isBlocked
      ) {
        finalCustomer = await tx.user.update({
          where: { id: appointment.customerId },
          data: {
            completedCount: nextCompleted,
            noShowCount: nextNoShow,
            isBlocked: nextBlocked,
          },
        });
      }

      return { updated, finalCustomer };
    });

    emitRealtimeEvent({
      type: "APPOINTMENT_UPDATED",
      appointmentId: result.updated.id,
      staffId: result.updated.staffId,
      status,
    });

    return NextResponse.json({
      ok: true,
      appointment: result.updated,
      customer: sanitizeUserForClient(result.finalCustomer),
    });
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudo actualizar el estado de la cita.");
  }
}

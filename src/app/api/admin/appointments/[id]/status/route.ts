// src/app/api/admin/appointments/[id]/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "PROVIDER")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const { status, reason, blockCustomer } = await req.json();

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { customer: true, service: true, staff: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(reason ? { staffMoveReason: reason } : {}),
      },
    });

    let finalCustomer = appointment.customer;

    if (status === "CANCELLED") {
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

      await prisma.notification.create({
        data: {
          userId: appointment.customerId,
          appointmentId: appointment.id,
          type: "APPOINTMENT_CANCELLED",
          title: `Se canceló tu cita de las ${timeFormatted} (${serviceName})`,
          message: `Tu cita de ${serviceName} del ${dateFormatted} a las ${timeFormatted} con ${appointment.staff?.displayName || "el profesional"} fue cancelada: "${reason || "Imprevisto de agenda"}". Puedes agendar un nuevo horario cuando desees.`,
        },
      });
    } else if (status === "COMPLETED") {
      finalCustomer = await prisma.user.update({
        where: { id: appointment.customerId },
        data: { completedCount: { increment: 1 } },
      });
    } else if (status === "NO_SHOW") {
      let updatedUser = await prisma.user.update({
        where: { id: appointment.customerId },
        data: {
          noShowCount: { increment: 1 },
          ...(blockCustomer ? { isBlocked: true } : {}),
        },
      });

      // Smart limit rule: if 2 or more no-shows are reached, automatically block customer
      if (updatedUser.noShowCount >= 2 && !updatedUser.isBlocked) {
        updatedUser = await prisma.user.update({
          where: { id: appointment.customerId },
          data: { isBlocked: true },
        });
      }
      finalCustomer = updatedUser;
    } else if (blockCustomer !== undefined) {
      finalCustomer = await prisma.user.update({
        where: { id: appointment.customerId },
        data: { isBlocked: !!blockCustomer },
      });
    }

    return NextResponse.json({ ok: true, appointment: updated, customer: finalCustomer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

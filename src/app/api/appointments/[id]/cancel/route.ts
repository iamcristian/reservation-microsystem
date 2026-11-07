// src/app/api/appointments/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCustomerCancelAppointment } from "@/lib/booking-rules";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { staff: true, service: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const isStaffOrAdmin = user.role === "ADMIN" || user.role === "PROVIDER";
    const isOwner = appointment.customerId === user.id;

    if (!isOwner && !isStaffOrAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const settings = await prisma.businessSettings.findFirst({ where: { id: 1 } });
    const minNotice = settings?.minCancelNoticeHours ?? 6;

    // Check rules if customer is cancelling
    if (!isStaffOrAdmin) {
      const check = canCustomerCancelAppointment(appointment, minNotice);
      if (!check.allowed) {
        return NextResponse.json(
          {
            error: check.reason,
            whatsappUrl: `https://wa.me/${settings?.phoneWhatsapp?.replace(/\D/g, "")}`,
          },
          { status: 403 }
        );
      }
    }

    // Cancel appointment
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        // If cancelled by the customer themselves, clear staffMoveReason so UI doesn't report it as cancelled by doctor
        ...(!isStaffOrAdmin ? { staffMoveReason: null } : {}),
      },
    });

    // Mark any unread notifications related to this appointment as read when customer cancels it
    if (!isStaffOrAdmin) {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          appointmentId: id,
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ ok: true, appointment: updated });
  } catch (error: any) {
    console.error("Cancel appointment error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// src/app/api/notifications/[id]/read/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const updated = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        OR: [{ id }, { appointmentId: id }],
      },
      data: { isRead: true },
    });

    if (updated.count === 0) {
      // If dismissing a legacy cancelled appointment without a notification row, record a read marker
      const apt = await prisma.appointment.findFirst({
        where: { id, customerId: user.id },
      });
      if (apt) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            appointmentId: apt.id,
            type: "APPOINTMENT_CANCELLED",
            title: "Cita cancelada",
            message: apt.staffMoveReason || "Cita cancelada",
            isRead: true,
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

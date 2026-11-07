// src/app/api/appointments/[id]/ack-move/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

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

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (appointment.customerId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Acknowledge the change
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CONFIRMED",
      },
    });

    // Mark related notification as read
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        appointmentId: id,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true, appointment: updated });
  } catch (error: any) {
    console.error("Ack move error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

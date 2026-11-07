// src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAvailableSlotsForStaff } from "@/lib/slot-engine";

export const dynamic = "force-dynamic";

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
      return NextResponse.json({
        slots: [],
        message: "La fecha seleccionada está fuera del rango permitido.",
      });
    }

    // Determine Day of Week (0 = Domingo, 1 = Lunes ... 6 = Sábado)
    const dayOfWeek = requestedDate.getDay();

    // Query candidates
    let eligibleStaffIds: string[] = [];

    if (staffId === "ANY") {
      const staffServices = await prisma.staffService.findMany({
        where: {
          serviceId,
          staff: { isActive: true },
        },
        select: { staffId: true },
      });
      eligibleStaffIds = staffServices.map((s) => s.staffId);
    } else {
      eligibleStaffIds = [staffId];
    }

    if (eligibleStaffIds.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    // Query shifts, timeOffs, and appointments for that date range
    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999`);
    // Also include morning of next day in case shift goes past midnight
    const nextMorning = new Date(endOfDay.getTime() + 6 * 60 * 60 * 1000);

    const shifts = await prisma.workingShift.findMany({
      where: {
        staffId: { in: eligibleStaffIds },
        dayOfWeek,
      },
    });

    const timeOffs = await prisma.timeOff.findMany({
      where: {
        staffId: { in: eligibleStaffIds },
        startAt: { lte: nextMorning },
        endAt: { gte: startOfDay },
      },
    });

    const appointments = await prisma.appointment.findMany({
      where: {
        staffId: { in: eligibleStaffIds },
        startAt: { lte: nextMorning },
        endAt: { gte: startOfDay },
        status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
      },
    });

    const totalServiceDuration = service.durationMin + service.bufferAfterMin;
    const slotStep = settings?.slotStepMin ?? 30;

    // Collect slots across all eligible staff
    const allSlotsMap = new Map<string, string[]>(); // slotTime -> array of staffIds available

    for (const sId of eligibleStaffIds) {
      const staffProfile = await prisma.staffProfile.findUnique({ where: { id: sId } });
      if (!staffProfile || !staffProfile.isActive) continue;

      const staffHorizon =
        staffProfile.customHorizonDays ?? settings?.bookingHorizonDays ?? 7;
      if (diffDays > staffHorizon) continue;

      const staffLeadTime =
        staffProfile.customLeadTimeMin ?? settings?.minLeadTimeMinutes ?? 30;

      const staffShifts = shifts.filter((s) => s.staffId === sId);
      const staffTimeOffs = timeOffs.filter((t) => t.staffId === sId);
      const staffAppointments = appointments.filter((a) => a.staffId === sId);

      const availableForStaff = computeAvailableSlotsForStaff({
        dateStr,
        shifts: staffShifts,
        timeOffs: staffTimeOffs,
        appointments: staffAppointments,
        serviceDuration: totalServiceDuration,
        slotStepMin: slotStep,
        leadTimeMin: staffLeadTime,
      });

      for (const time of availableForStaff) {
        const current = allSlotsMap.get(time) || [];
        current.push(sId);
        allSlotsMap.set(time, current);
      }
    }

    const sortedSlots = Array.from(allSlotsMap.keys()).sort();

    return NextResponse.json({
      date: dateStr,
      service,
      slots: sortedSlots,
      slotStaffMapping: Object.fromEntries(allSlotsMap),
    });
  } catch (error: any) {
    console.error("Availability error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

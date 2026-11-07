// src/app/api/appointments/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setSessionUserId } from "@/lib/session";
import { parseDateAndTime, computeAvailableSlotsForStaff } from "@/lib/slot-engine";
import {
  consumeRateLimit,
  getClientIp,
  peekRateLimit,
  resetRateLimit,
  tooManyRequestsBody,
} from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const BOOK_AUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_BOOK_AUTH_FAILS = 5;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      serviceId,
      staffId,
      date,
      time,
      customerName,
      customerEmail,
      customerPassword,
      customerPhone,
      customerNotes,
    } = body;

    let user = await getCurrentUser();

    // If not authenticated, require credentials to prevent account impersonation
    if (!user) {
      if (!customerEmail || !customerName) {
        return NextResponse.json(
          { error: "Por favor proporciona tu nombre y correo electrónico para confirmar la cita." },
          { status: 400 }
        );
      }

      const cleanEmail = customerEmail.trim().toLowerCase();
      const ip = getClientIp(req);
      const authRateKey = `book-auth-fail:${ip}:${cleanEmail}`;

      const rateCheck = peekRateLimit(authRateKey, MAX_BOOK_AUTH_FAILS, BOOK_AUTH_WINDOW_MS);
      if (!rateCheck.allowed) {
        return NextResponse.json(tooManyRequestsBody(rateCheck.retryAfterSec), {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSec) },
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (existingUser) {
        // Existing account: MUST verify password to prevent unauthorized impersonation
        if (!customerPassword) {
          return NextResponse.json(
            {
              error:
                "Ya existe una cuenta con este correo. Ingresa tu contraseña para confirmar la cita.",
              requiresPassword: true,
            },
            { status: 401 }
          );
        }

        if (existingUser.passwordHash) {
          const isMatch = await bcrypt.compare(customerPassword, existingUser.passwordHash);
          if (!isMatch) {
            const failState = consumeRateLimit(authRateKey, MAX_BOOK_AUTH_FAILS, BOOK_AUTH_WINDOW_MS);
            if (!failState.allowed) {
              return NextResponse.json(tooManyRequestsBody(failState.retryAfterSec), {
                status: 429,
                headers: { "Retry-After": String(failState.retryAfterSec) },
              });
            }
            return NextResponse.json(
              {
                error: "Contraseña incorrecta. Por favor ingresa la contraseña de tu cuenta.",
                requiresPassword: true,
              },
              { status: 401 }
            );
          }
          resetRateLimit(authRateKey);
        }
        user = existingUser;
      } else {
        // New customer: create account with password
        if (!customerPassword || typeof customerPassword !== "string" || customerPassword.length < 6 || customerPassword.length > 128) {
          return NextResponse.json(
            {
              error: "Crea una contraseña (mínimo 6 caracteres) para proteger tu cuenta y tus citas.",
              requiresPassword: true,
            },
            { status: 400 }
          );
        }

        const passwordHash = await bcrypt.hash(customerPassword, 10);
        user = await prisma.user.create({
          data: {
            email: cleanEmail,
            name: customerName.trim(),
            passwordHash,
            phone: customerPhone ? customerPhone.trim() : null,
            role: "CUSTOMER",
          },
        });
      }

      // Establish secure session
      await setSessionUserId(user.id);
    }

    // Acceptance Criterion: A professional provider account (PROVIDER) is not a customer.
    // Doctors manage appointments in /admin and cannot self-book in the public customer flow.
    if (user.role === "PROVIDER") {
      return NextResponse.json(
        {
          error:
            "Las cuentas profesionales de doctores no pueden realizar reservas como pacientes. Para consultar o agendar pacientes, utiliza el Panel de Gestión en /admin.",
        },
        { status: 403 }
      );
    }

    if (user.isBlocked) {
      return NextResponse.json(
        {
          error:
            "Tu cuenta ha sido bloqueada para agendar en línea. Por favor comunícate directamente con nosotros.",
        },
        { status: 403 }
      );
    }

    if (!serviceId || !date || !time) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (servicio, fecha u hora)." },
        { status: 400 }
      );
    }

    // Save/update phone if provided or missing
    if (customerPhone && customerPhone.trim().length > 4) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: customerPhone.trim() },
      });
      user.phone = customerPhone.trim();
    } else if (!user.phone) {
      return NextResponse.json(
        { error: "Por favor proporciona un número de teléfono de contacto." },
        { status: 400 }
      );
    }

    const settings = await prisma.businessSettings.findFirst({ where: { id: 1 } });
    const maxActive = settings?.maxActiveBookings ?? 2;

    // Check customer active bookings limit
    const now = new Date();
    const activeBookingsCount = await prisma.appointment.count({
      where: {
        customerId: user.id,
        startAt: { gte: now },
        status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
      },
    });

    if (activeBookingsCount >= maxActive) {
      return NextResponse.json(
        {
          error: `Ya tienes ${activeBookingsCount} citas futuras activas (el máximo permitido es ${maxActive}). Asiste a tu cita o modifícala antes de reservar una nueva.`,
        },
        { status: 429 }
      );
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Servicio no encontrado o inactivo." }, { status: 404 });
    }

    // Validate date and time format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json(
        { error: "Formato de fecha (YYYY-MM-DD) u hora (HH:mm) inválido." },
        { status: 400 }
      );
    }

    const startAt = parseDateAndTime(date, time);
    if (isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Fecha u hora inválida." }, { status: 400 });
    }

    const totalDurationMin = service.durationMin + service.bufferAfterMin;
    const endAt = new Date(startAt.getTime() + totalDurationMin * 60_000);
    const slotStep = settings?.slotStepMin ?? 30;

    const requestedDate = new Date(`${date}T00:00:00`);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (requestedDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      return NextResponse.json(
        { error: "No es posible agendar citas en fechas pasadas." },
        { status: 400 }
      );
    }

    const dayOfWeek = requestedDate.getDay();
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59.999`);
    const nextMorning = new Date(endOfDay.getTime() + 6 * 60 * 60 * 1000);

    // Check if specific staff has FULL_DAY_OFF or VACATION on this date
    if (staffId && staffId !== "ANY") {
      const fullDayOff = await prisma.timeOff.findFirst({
        where: {
          staffId,
          type: { in: ["FULL_DAY_OFF", "VACATION"] },
          startAt: { lte: endOfDay },
          endAt: { gte: startOfDay },
        },
      });
      if (fullDayOff) {
        return NextResponse.json(
          {
            error: `El profesional no se encuentra atendiendo en esta fecha (${
              fullDayOff.reason || "Periodo de vacaciones o día cerrado"
            }).`,
          },
          { status: 409 }
        );
      }
    }

    // Helper to verify if a candidate staff member is genuinely available at `date` & `time`
    const isStaffAvailableForSlot = async (candidateStaffId: string) => {
      const staffProfile = await prisma.staffProfile.findUnique({
        where: { id: candidateStaffId },
      });
      if (!staffProfile || !staffProfile.isActive) {
        return { ok: false, reason: "El profesional seleccionado no se encuentra activo." };
      }

      const staffHorizon = staffProfile.customHorizonDays ?? settings?.bookingHorizonDays ?? 7;
      if (diffDays > staffHorizon) {
        return {
          ok: false,
          reason: `La agenda del profesional solo está abierta para los próximos ${staffHorizon} días.`,
        };
      }

      const staffLeadTime = staffProfile.customLeadTimeMin ?? settings?.minLeadTimeMinutes ?? 30;
      const staffShifts = await prisma.workingShift.findMany({
        where: { staffId: candidateStaffId, dayOfWeek },
      });
      const staffTimeOffs = await prisma.timeOff.findMany({
        where: {
          staffId: candidateStaffId,
          startAt: { lte: nextMorning },
          endAt: { gte: startOfDay },
        },
      });
      const staffAppointments = await prisma.appointment.findMany({
        where: {
          staffId: candidateStaffId,
          startAt: { lte: nextMorning },
          endAt: { gte: startOfDay },
          status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
        },
      });

      const validSlots = computeAvailableSlotsForStaff({
        dateStr: date,
        shifts: staffShifts,
        timeOffs: staffTimeOffs,
        appointments: staffAppointments,
        serviceDuration: totalDurationMin,
        slotStepMin: slotStep,
        leadTimeMin: staffLeadTime,
        now,
      });

      if (!validSlots.includes(time)) {
        return {
          ok: false,
          reason: "El horario seleccionado no está disponible o ya pasó el margen de reserva.",
        };
      }

      return { ok: true };
    };

    // Determine target staff
    let targetStaffId = staffId;
    if (!targetStaffId || targetStaffId === "ANY") {
      // Find eligible staff that do this service
      const eligible = await prisma.staffService.findMany({
        where: { serviceId },
        include: { staff: true },
      });

      let chosenStaffId: string | null = null;
      for (const item of eligible) {
        if (!item.staff.isActive) continue;
        const check = await isStaffAvailableForSlot(item.staffId);
        if (check.ok) {
          chosenStaffId = item.staffId;
          break;
        }
      }

      if (!chosenStaffId) {
        return NextResponse.json(
          { error: "No hay profesionales disponibles en este horario exacto." },
          { status: 409 }
        );
      }
      targetStaffId = chosenStaffId;
    } else {
      // Verify that specific staffId is assigned to this service
      const isAssigned = await prisma.staffService.findUnique({
        where: {
          staffId_serviceId: {
            staffId: targetStaffId,
            serviceId,
          },
        },
      });
      if (!isAssigned) {
        return NextResponse.json(
          { error: "El profesional seleccionado no ofrece este servicio." },
          { status: 400 }
        );
      }

      const check = await isStaffAvailableForSlot(targetStaffId);
      if (!check.ok) {
        return NextResponse.json(
          { error: check.reason },
          { status: 409 }
        );
      }
    }

    // Atomic collision check on chosen staff
    const conflict = await prisma.appointment.findFirst({
      where: {
        staffId: targetStaffId,
        status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "¡Ups! Este horario acaba de ser ocupado. Por favor elige otro." },
        { status: 409 }
      );
    }

    const timeOff = await prisma.timeOff.findFirst({
      where: {
        staffId: targetStaffId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (timeOff) {
      return NextResponse.json(
        { error: "El profesional no se encuentra disponible en esa franja horaria." },
        { status: 409 }
      );
    }

    // Create appointment
    const newAppointment = await prisma.appointment.create({
      data: {
        customerId: user.id,
        staffId: targetStaffId,
        serviceId,
        startAt,
        endAt,
        status: "CONFIRMED",
        priceSnapshot: service.price,
        customerNotes: customerNotes ? String(customerNotes).trim().slice(0, 500) : null,
      },
      include: {
        service: true,
        staff: true,
      },
    });

    return NextResponse.json({ ok: true, appointment: newAppointment });
  } catch (error: any) {
    console.error("Booking error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

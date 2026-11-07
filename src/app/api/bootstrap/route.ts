// src/app/api/bootstrap/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCustomerCancelAppointment } from "@/lib/booking-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let settings = await prisma.businessSettings.findFirst({
      where: { id: 1 },
    });

    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {
          id: 1,
          name: "Clínica Dental & Estética Sonrisa",
          tagline: "Atención odontológica y estética de primer nivel",
          logoUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80",
          addressText: "Av. Simón López esq. Av. Beijing, Cochabamba, Bolivia",
          googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-17.3713,-66.1742",
          phoneWhatsapp: "+52 55 1234 5678",
          currencySymbol: "$",
          staffLabel: "Doctor(a)",
          slotStepMin: 30,
          bookingHorizonDays: 7,
          minLeadTimeMinutes: 30,
          maxActiveBookings: 2,
          minCancelNoticeHours: 6,
          themePrimaryHex: "#1F1F23",
          themeSurfaceHex: "#9FA0A6",
        },
      });
    }

    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const currentUser = await getCurrentUser();
    const isStaffOrAdmin =
      currentUser &&
      (currentUser.role === "ADMIN" || currentUser.role === "PROVIDER");

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const staff = await prisma.staffProfile.findMany({
      where: isStaffOrAdmin ? {} : { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        services: true,
        workingShifts: true,
        timeOffs: {
          where: {
            endAt: { gte: startOfToday },
          },
          orderBy: { startAt: "asc" },
        },
      },
    });

    let userAppointments: any[] = [];
    let notifications: any[] = [];

    if (currentUser) {
      const apts = await prisma.appointment.findMany({
        where: { customerId: currentUser.id },
        include: {
          service: true,
          staff: true,
        },
        orderBy: { startAt: "desc" },
      });

      userAppointments = apts.map((apt) => {
        const cancelCheck = canCustomerCancelAppointment(
          apt,
          settings?.minCancelNoticeHours ?? 6
        );
        return {
          ...apt,
          canCancel: cancelCheck.allowed,
          cancelReason: cancelCheck.reason,
          isFreeCancellationBecauseOfStaff: cancelCheck.isFreeCancellationBecauseOfStaff,
        };
      });

      notifications = await prisma.notification.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    }

    let allAppointments: any[] = [];
    let allUsers: any[] = [];

    // Expose allAppointments and allUsers only to ADMIN and PROVIDER
    if (currentUser && (currentUser.role === "ADMIN" || currentUser.role === "PROVIDER")) {
      allAppointments = await prisma.appointment.findMany({
        include: {
          service: true,
          staff: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isBlocked: true,
              noShowCount: true,
            },
          },
        },
        orderBy: { startAt: "asc" },
      });

      allUsers = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          isBlocked: true,
          noShowCount: true,
          completedCount: true,
        },
      });
    }

    return NextResponse.json({
      settings,
      services,
      staff,
      currentUser,
      userAppointments,
      allAppointments,
      notifications,
      allUsers,
    });
  } catch (error: any) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Error al cargar datos",
        settings: null,
        services: [],
        staff: [],
        currentUser: null,
        userAppointments: [],
        allAppointments: [],
        notifications: [],
        allUsers: [],
      },
      { status: 500 }
    );
  }
}

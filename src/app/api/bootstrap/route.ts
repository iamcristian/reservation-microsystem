// src/app/api/bootstrap/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getImpersonatorId } from "@/lib/session";
import { getCustomerBootstrapAppointments } from "@/lib/appointment-queries";

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
      include: {
        staff: true,
      },
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
        // Linked account data (internal id, email, phone, role) is staff-only.
        // Public visitors only need the display profile (name, specialty, avatar).
        ...(isStaffOrAdmin
          ? {
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  phone: true,
                },
              },
            }
          : {}),
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

    // Public staff payload must not leak the linked account id (used to be an account-takeover vector).
    const safeStaff = isStaffOrAdmin
      ? staff
      : staff.map(({ userId: _userId, ...rest }) => rest);

    let userAppointments: any[] = [];
    let userHistory: {
      items: any[];
      nextCursor: string | null;
      hasMore: boolean;
      totalCount: number;
    } = {
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: 0,
    };
    let notifications: any[] = [];

    if (currentUser) {
      const [custData, notifs] = await Promise.all([
        getCustomerBootstrapAppointments(
          currentUser.id,
          settings?.minCancelNoticeHours ?? 6
        ),
        prisma.notification.findMany({
          where: { userId: currentUser.id },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

      userAppointments = custData.userAppointments;
      userHistory = custData.userHistory;
      notifications = notifs;
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

    // Never ship credential material or internal notes to the browser.
    const safeCurrentUser = currentUser
      ? (({ passwordHash: _ph, googleId: _gid, adminNotes: _notes, ...rest }) => rest)(
          currentUser as any
        )
      : null;

    const impersonatorId =
      currentUser && currentUser.role === "PROVIDER" ? await getImpersonatorId() : null;

    return NextResponse.json({
      settings,
      services,
      staff: safeStaff,
      currentUser: safeCurrentUser,
      impersonatorId,
      userAppointments,
      userHistory,
      allAppointments,
      notifications,
      allUsers,
    });
  } catch (error: any) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      {
        error: "Error al cargar datos",
        settings: null,
        services: [],
        staff: [],
        currentUser: null,
        userAppointments: [],
        userHistory: { items: [], nextCursor: null, hasMore: false, totalCount: 0 },
        allAppointments: [],
        notifications: [],
        allUsers: [],
      },
      { status: 500 }
    );
  }
}

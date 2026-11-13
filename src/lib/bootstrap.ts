import { prisma } from "@/lib/prisma";
import { getCurrentUser, getImpersonatorId } from "@/lib/session";
import { getCustomerBootstrapAppointments } from "@/lib/appointment-queries";
import { DEFAULT_BUSINESS_LOGO } from "@/lib/avatars";

export interface BootstrapHistoryPage {
  items: any[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

export interface BootstrapPayload {
  settings: any;
  services: any[];
  staff: any[];
  currentUser: any;
  impersonatorId?: string | null;
  userAppointments: any[];
  userHistory: BootstrapHistoryPage;
  allAppointments: any[];
  notifications: any[];
  allUsers: any[];
  error?: string;
}

export const EMPTY_BOOTSTRAP_PAYLOAD: BootstrapPayload = {
  settings: null,
  services: [],
  staff: [],
  currentUser: null,
  impersonatorId: null,
  userAppointments: [],
  userHistory: { items: [], nextCursor: null, hasMore: false, totalCount: 0 },
  allAppointments: [],
  notifications: [],
  allUsers: [],
};

export async function getBootstrapPayload(options: { publicOnly?: boolean } = {}): Promise<BootstrapPayload> {
  let settings = await prisma.businessSettings.findFirst({
    where: { id: 1 },
  });

  if (!settings) {
    settings = await prisma.businessSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: "Mi Negocio",
        tagline: "Reserva tu cita en segundos",
        logoUrl: DEFAULT_BUSINESS_LOGO,
        addressText: "Av. Principal 123, Bolivia",
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-17.3895,-66.1568",
        phoneWhatsapp: "+59170000000",
        currencySymbol: "Bs",
        staffLabel: "Especialista",
        slotStepMin: 30,
        bookingHorizonDays: 7,
        minLeadTimeMinutes: 30,
        maxActiveBookings: 2,
        minCancelNoticeHours: 6,
        themePrimaryHex: "#1F1F23",
        themeSurfaceHex: "#9FA0A6",
      },
    });
  } else if (
    settings.name === "Clínica Dental & Estética Sonrisa" &&
    settings.currencySymbol === "$"
  ) {
    settings = await prisma.businessSettings.update({
      where: { id: 1 },
      data: {
        name: "Mi Negocio",
        tagline: "Reserva tu cita en segundos",
        logoUrl: DEFAULT_BUSINESS_LOGO,
        currencySymbol: "Bs",
        staffLabel: "Especialista",
        phoneWhatsapp:
          settings.phoneWhatsapp === "+52 55 1234 5678"
            ? "+59170000000"
            : settings.phoneWhatsapp,
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

  const currentUser = options.publicOnly ? null : await getCurrentUser();
  const isStaffOrAdmin =
    !options.publicOnly &&
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
  let userHistory: BootstrapHistoryPage = {
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

  // Expose full roster & global appointments only to ADMIN; PROVIDER receives only their own agenda
  if (currentUser && currentUser.role === "ADMIN") {
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
  } else if (currentUser && currentUser.role === "PROVIDER") {
    const ownProfile = staff.find((s) => (s as { userId?: string }).userId === currentUser.id);
    if (ownProfile) {
      allAppointments = await prisma.appointment.findMany({
        where: { staffId: ownProfile.id },
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
    }
  }

  // Never ship credential material or internal notes to the browser.
  const safeCurrentUser = currentUser
    ? (({ passwordHash: _ph, googleId: _gid, adminNotes: _notes, ...rest }) => rest)(
        currentUser as any
      )
    : null;

  const impersonatorId =
    currentUser && currentUser.role === "PROVIDER" ? await getImpersonatorId() : null;

  return {
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
  };
}

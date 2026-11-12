// src/lib/appointment-queries.ts
import { prisma } from "@/lib/prisma";
import { canCustomerCancelAppointment } from "@/lib/booking-rules";

export const HISTORY_PAGE_SIZE = 6;
export const MAX_HISTORY_PAGE_SIZE = 25;

const SAFE_HISTORY_INCLUDE = {
  service: true,
  staff: {
    select: {
      id: true,
      displayName: true,
      specialtyTitle: true,
      avatarUrl: true,
    },
  },
} as const;

/**
 * Prisma filter matching a customer's historical / archived appointments:
 * - Explicitly completed, cancelled, or archived no-shows
 * - Past CONFIRMED / RESCHEDULED_BY_STAFF whose end time has already elapsed
 */
export function buildCustomerHistoryWhere(customerId: string, now = new Date()) {
  return {
    customerId,
    OR: [
      { status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW_ARCHIVED"] } },
      {
        status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
        endAt: { lte: now },
      },
    ],
  };
}

/**
 * Cursor-paginated slice of a customer's historical appointments (newest first),
 * engineered to scale cleanly to thousands of records without full-table loads.
 */
export async function getCustomerHistoryPage({
  customerId,
  cursor,
  limit = HISTORY_PAGE_SIZE,
  now = new Date(),
}: {
  customerId: string;
  cursor?: string | null;
  limit?: number;
  now?: Date;
}) {
  const safeLimit = Math.min(Math.max(limit || HISTORY_PAGE_SIZE, 1), MAX_HISTORY_PAGE_SIZE);
  const where = buildCustomerHistoryWhere(customerId, now);

  const [rows, totalCount] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: SAFE_HISTORY_INCLUDE,
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
      take: safeLimit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.appointment.count({ where }),
  ]);

  const hasMore = rows.length > safeLimit;
  const pageItems = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;

  const items = pageItems.map((apt) => ({
    ...apt,
    canCancel: false,
    cancelReason: "Esta cita pertenece a tu historial.",
    isFreeCancellationBecauseOfStaff: false,
  }));

  return {
    items,
    nextCursor,
    hasMore,
    totalCount,
  };
}

/**
 * Fetches only the customer's active/no-show appointments plus the first history page,
 * preventing O(N) full-history transfers in /api/bootstrap.
 */
export async function getCustomerBootstrapAppointments(
  customerId: string,
  minCancelNoticeHours: number,
  now = new Date()
) {
  const [activeRows, historyPage] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        customerId,
        OR: [
          { status: "NO_SHOW" },
          {
            status: { in: ["CONFIRMED", "RESCHEDULED_BY_STAFF"] },
            endAt: { gt: now },
          },
        ],
      },
      include: SAFE_HISTORY_INCLUDE,
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
    }),
    getCustomerHistoryPage({
      customerId,
      limit: HISTORY_PAGE_SIZE,
      now,
    }),
  ]);

  const activeAnnotated = activeRows.map((apt) => {
    const cancelCheck = canCustomerCancelAppointment(apt, minCancelNoticeHours, now);
    return {
      ...apt,
      canCancel: cancelCheck.allowed,
      cancelReason: cancelCheck.reason,
      isFreeCancellationBecauseOfStaff: cancelCheck.isFreeCancellationBecauseOfStaff,
    };
  });

  return {
    userAppointments: [...activeAnnotated, ...historyPage.items],
    userHistory: historyPage,
  };
}

import { formatLocalDateYYYYMMDD } from "@/lib/date-utils";

export interface PublicTimeOffNotice {
  id: string;
  staffId: string;
  staffName?: string;
  type: string; // "VACATION" | "FULL_DAY_OFF" | "LATE_START" | "EARLY_LEAVE" | "CUSTOM_BLOCK"
  reason?: string | null;
  startAt: string;
  endAt: string;
}

export type AvailabilityUnavailableCode =
  | "STAFF_PAUSED"
  | "VACATION"
  | "FULL_DAY_OFF"
  | "TIME_OFF_BLOCKED"
  | "OUTSIDE_HORIZON"
  | "NO_WORKING_SHIFT"
  | "TODAY_EXHAUSTED"
  | "ALL_BOOKED"
  | "NO_SLOTS";

export interface AvailabilityUnavailableReason {
  code: AvailabilityUnavailableCode;
  title: string;
  description: string;
  blocks?: PublicTimeOffNotice[];
}

export interface TimeOffDisplayInfo {
  badgeEmoji: string;
  badgeLabel: string;
  categoryTitle: string;
  periodLabel: string;
  note: string | null;
}

export const WEEKDAY_NAMES_PLURAL = [
  "domingos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
];

const BLOCK_TYPE_META: Record<
  string,
  { badgeEmoji: string; badgeLabel: string; categoryTitle: string }
> = {
  VACATION: {
    badgeEmoji: "🏖️",
    badgeLabel: "Vacaciones",
    categoryTitle: "Vacaciones programadas",
  },
  FULL_DAY_OFF: {
    badgeEmoji: "⛔",
    badgeLabel: "Cerrado",
    categoryTitle: "Día sin atención",
  },
  LATE_START: {
    badgeEmoji: "🌅",
    badgeLabel: "Inicio tarde",
    categoryTitle: "Ingreso más tarde",
  },
  EARLY_LEAVE: {
    badgeEmoji: "🌇",
    badgeLabel: "Cierre temprano",
    categoryTitle: "Salida anticipada",
  },
  CUSTOM_BLOCK: {
    badgeEmoji: "⏳",
    badgeLabel: "Bloqueado",
    categoryTitle: "Horario bloqueado",
  },
};

function formatShortLocalDate(d: Date): string {
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatShortTime(d: Date): string {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isTimeOffOnDate(
  timeOff: { type?: string; startAt: Date | string; endAt: Date | string },
  dateStr: string
): boolean {
  const s = new Date(timeOff.startAt).getTime();
  const e = new Date(timeOff.endAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return false;

  const durationMs = e - s;
  const isFullOrMultiDay =
    timeOff.type === "FULL_DAY_OFF" ||
    timeOff.type === "VACATION" ||
    durationMs >= 20 * 60 * 60 * 1000;

  if (isFullOrMultiDay) {
    const startYmd = formatLocalDateYYYYMMDD(new Date(s + 6 * 3600_000));
    const endYmd = formatLocalDateYYYYMMDD(
      new Date(Math.max(s, e - 6 * 3600_000))
    );
    return dateStr >= startYmd && dateStr <= endYmd;
  }

  return formatLocalDateYYYYMMDD(new Date((s + e) / 2)) === dateStr;
}

/**
 * Extracts a human-readable optional note from TimeOff.reason.
 * For VACATION, generic defaults ("Vacaciones", "Vacaciones programadas") are omitted
 * because the vacation category headline already states it, avoiding duplicate copy.
 */
export function getTimeOffCustomNote(block: {
  type?: string;
  reason?: string | null;
}): string | null {
  const trimmed = (block.reason || "").trim();
  if (!trimmed) return null;
  if (
    block.type === "VACATION" &&
    /^vacaciones(\s+programadas)?$/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function describeTimeOffBlock(block: {
  type?: string;
  reason?: string | null;
  startAt: Date | string;
  endAt: Date | string;
}): TimeOffDisplayInfo {
  const blockType = block.type || "CUSTOM_BLOCK";
  const meta = BLOCK_TYPE_META[blockType] || BLOCK_TYPE_META.CUSTOM_BLOCK;

  const start = new Date(block.startAt);
  const end = new Date(block.endAt);
  const isFullSpan =
    blockType === "VACATION" ||
    blockType === "FULL_DAY_OFF" ||
    (start.getHours() === 0 &&
      start.getMinutes() === 0 &&
      end.getHours() === 23 &&
      end.getMinutes() >= 58);

  const displayStart = isFullSpan
    ? new Date(start.getTime() + 6 * 3600_000)
    : start;
  const displayEnd = isFullSpan
    ? new Date(Math.max(start.getTime(), end.getTime() - 6 * 3600_000))
    : end;
  const startYmd = formatLocalDateYYYYMMDD(displayStart);
  const endYmd = formatLocalDateYYYYMMDD(displayEnd);

  let periodLabel: string;
  if (isFullSpan) {
    periodLabel =
      startYmd === endYmd
        ? `Todo el día (${formatShortLocalDate(displayStart)})`
        : `Del ${formatShortLocalDate(displayStart)} al ${formatShortLocalDate(displayEnd)}`;
  } else if (blockType === "LATE_START") {
    periodLabel = `Atención inicia a partir de las ${formatShortTime(end)}`;
  } else if (blockType === "EARLY_LEAVE") {
    periodLabel = `Cierre anticipado desde las ${formatShortTime(start)}`;
  } else {
    periodLabel =
      startYmd === endYmd
        ? `Bloqueado de ${formatShortTime(start)} a ${formatShortTime(end)}`
        : `Del ${formatShortLocalDate(start)} ${formatShortTime(
            start
          )} al ${formatShortLocalDate(end)} ${formatShortTime(end)}`;
  }

  return {
    badgeEmoji: meta.badgeEmoji,
    badgeLabel: meta.badgeLabel,
    categoryTitle: meta.categoryTitle,
    periodLabel,
    note: getTimeOffCustomNote(block),
  };
}

export function getStaffWindowTimeOffs(
  timeOffs: Array<{
    id?: string;
    type?: string;
    reason?: string | null;
    startAt: Date | string;
    endAt: Date | string;
  }> = [],
  windowStart: Date,
  windowEnd: Date
) {
  const sorted = [...timeOffs].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  const coveringWholeWindow =
    sorted.find((to) => {
      const s = new Date(to.startAt);
      const e = new Date(to.endAt);
      return s <= windowStart && e >= windowEnd;
    }) || null;

  const upcomingVacations = sorted.filter((to) => {
    const s = new Date(to.startAt);
    const e = new Date(to.endAt);
    const isVacation =
      to.type === "VACATION" ||
      e.getTime() - s.getTime() > 24 * 60 * 60 * 1000;
    return isVacation && s <= windowEnd && e >= windowStart;
  });

  return { coveringWholeWindow, upcomingVacations };
}


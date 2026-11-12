// src/app/api/appointments/history/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  getCustomerHistoryPage,
  HISTORY_PAGE_SIZE,
  MAX_HISTORY_PAGE_SIZE,
} from "@/lib/appointment-queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawCursor = searchParams.get("cursor");
    const cursor =
      typeof rawCursor === "string" && rawCursor.trim().length > 0 && rawCursor.length <= 64
        ? rawCursor.trim()
        : null;

    const rawLimit = Number(searchParams.get("limit") || HISTORY_PAGE_SIZE);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_HISTORY_PAGE_SIZE)
      : HISTORY_PAGE_SIZE;

    const page = await getCustomerHistoryPage({
      customerId: currentUser.id,
      cursor,
      limit,
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error("Error fetching appointment history page:", error);
    return NextResponse.json(
      { error: "No se pudo cargar el historial de citas." },
      { status: 500 }
    );
  }
}

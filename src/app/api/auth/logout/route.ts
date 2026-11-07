// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearSessionUser();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al cerrar sesión" },
      { status: 500 }
    );
  }
}

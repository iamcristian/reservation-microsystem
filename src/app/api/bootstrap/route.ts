// src/app/api/bootstrap/route.ts
import { NextResponse } from "next/server";
import { EMPTY_BOOTSTRAP_PAYLOAD, getBootstrapPayload } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getBootstrapPayload();
    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      {
        error: "Error al cargar datos",
        ...EMPTY_BOOTSTRAP_PAYLOAD,
      },
      { status: 500 }
    );
  }
}

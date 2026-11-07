// src/app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();

    const updated = await prisma.businessSettings.update({
      where: { id: 1 },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        tagline: body.tagline !== undefined ? body.tagline : undefined,
        logoUrl: body.logoUrl !== undefined ? body.logoUrl : undefined,
        addressText: body.addressText !== undefined ? body.addressText : undefined,
        googleMapsUrl:
          body.googleMapsUrl !== undefined ? body.googleMapsUrl : undefined,
        phoneWhatsapp:
          body.phoneWhatsapp !== undefined ? body.phoneWhatsapp : undefined,
        currencySymbol:
          body.currencySymbol !== undefined ? body.currencySymbol : undefined,
        staffLabel: body.staffLabel !== undefined ? body.staffLabel : undefined,
        bookingHorizonDays:
          body.bookingHorizonDays !== undefined
            ? Number(body.bookingHorizonDays)
            : undefined,
        minLeadTimeMinutes:
          body.minLeadTimeMinutes !== undefined
            ? Number(body.minLeadTimeMinutes)
            : undefined,
        minCancelNoticeHours:
          body.minCancelNoticeHours !== undefined
            ? Number(body.minCancelNoticeHours)
            : undefined,
        maxActiveBookings:
          body.maxActiveBookings !== undefined
            ? Number(body.maxActiveBookings)
            : undefined,
        themePrimaryHex:
          body.themePrimaryHex !== undefined ? body.themePrimaryHex : undefined,
        themeSurfaceHex:
          body.themeSurfaceHex !== undefined ? body.themeSurfaceHex : undefined,
      },
    });

    return NextResponse.json({ ok: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

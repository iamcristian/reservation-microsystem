// src/app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  safeErrorResponse,
  verifySameOrigin,
} from "@/lib/api-guard";
import {
  clampInt,
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizeImageOrDataUrl,
} from "@/lib/validation/input-validators";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));

    let validatedLogoUrl: string | null | undefined = undefined;
    if (body.logoUrl !== undefined) {
      const logoCheck = sanitizeImageOrDataUrl(body.logoUrl);
      if (!logoCheck.ok) {
        return NextResponse.json({ error: logoCheck.error }, { status: 400 });
      }
      validatedLogoUrl = logoCheck.value;
    }

    let validatedMapsUrl: string | undefined = undefined;
    if (body.googleMapsUrl !== undefined) {
      const mapsCheck = sanitizeHttpUrl(body.googleMapsUrl);
      if (!mapsCheck.ok) {
        return NextResponse.json({ error: mapsCheck.error }, { status: 400 });
      }
      validatedMapsUrl = mapsCheck.value;
    }

    const updated = await prisma.businessSettings.update({
      where: { id: 1 },
      data: {
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name.trim().slice(0, 120)
            : undefined,
        tagline:
          typeof body.tagline === "string"
            ? body.tagline.trim().slice(0, 180)
            : undefined,
        logoUrl: validatedLogoUrl,
        addressText:
          typeof body.addressText === "string"
            ? body.addressText.trim().slice(0, 220)
            : undefined,
        googleMapsUrl: validatedMapsUrl,
        phoneWhatsapp:
          typeof body.phoneWhatsapp === "string"
            ? body.phoneWhatsapp.trim().slice(0, 32)
            : undefined,
        currencySymbol:
          typeof body.currencySymbol === "string" && body.currencySymbol.trim()
            ? body.currencySymbol.trim().slice(0, 8)
            : undefined,
        staffLabel:
          typeof body.staffLabel === "string" && body.staffLabel.trim()
            ? body.staffLabel.trim().slice(0, 40)
            : undefined,
        slotStepMin:
          body.slotStepMin !== undefined
            ? clampInt(body.slotStepMin, 5, 120, 30)
            : undefined,
        bookingHorizonDays:
          body.bookingHorizonDays !== undefined
            ? clampInt(body.bookingHorizonDays, 1, 90, 7)
            : undefined,
        minLeadTimeMinutes:
          body.minLeadTimeMinutes !== undefined
            ? clampInt(body.minLeadTimeMinutes, 0, 1440, 30)
            : undefined,
        minCancelNoticeHours:
          body.minCancelNoticeHours !== undefined
            ? clampInt(body.minCancelNoticeHours, 0, 168, 6)
            : undefined,
        maxActiveBookings:
          body.maxActiveBookings !== undefined
            ? clampInt(body.maxActiveBookings, 1, 20, 2)
            : undefined,
        themePrimaryHex:
          body.themePrimaryHex !== undefined
            ? sanitizeHexColor(body.themePrimaryHex, "#1F1F23")
            : undefined,
        themeSurfaceHex:
          body.themeSurfaceHex !== undefined
            ? sanitizeHexColor(body.themeSurfaceHex, "#9FA0A6")
            : undefined,
      },
    });

    return NextResponse.json({ ok: true, settings: updated });
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudieron guardar los ajustes del negocio.");
  }
}

// src/app/api/admin/services/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  safeErrorResponse,
  verifySameOrigin,
} from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireAdmin(
      "Solo el Administrador/Dueño principal puede crear o modificar el catálogo de servicios."
    );
    if (auth.error) return auth.error;

    const { name, description, durationMin, bufferAfterMin, price, staffIds } =
      await req.json();

    const cleanName = String(name || "").trim().slice(0, 120);
    const numDuration = Number(durationMin);
    const numBuffer = Number(bufferAfterMin || 0);
    const numPrice = Number(price);

    if (cleanName.length < 2) {
      return NextResponse.json(
        { error: "El nombre del servicio debe tener al menos 2 caracteres." },
        { status: 400 }
      );
    }

    if (isNaN(numDuration) || numDuration < 5 || numDuration > 480) {
      return NextResponse.json(
        { error: "La duración debe estar entre 5 y 480 minutos." },
        { status: 400 }
      );
    }

    if (isNaN(numBuffer) || numBuffer < 0 || numBuffer > 120) {
      return NextResponse.json(
        { error: "El tiempo de limpieza (buffer) debe estar entre 0 y 120 minutos." },
        { status: 400 }
      );
    }

    if (isNaN(numPrice) || numPrice < 0 || numPrice > 100_000) {
      return NextResponse.json(
        { error: "El precio debe estar entre 0 y 100,000." },
        { status: 400 }
      );
    }

    const newService = await prisma.service.create({
      data: {
        name: cleanName,
        description: description ? String(description).trim().slice(0, 400) : null,
        durationMin: Math.round(numDuration),
        bufferAfterMin: Math.round(numBuffer),
        price: numPrice,
        isActive: true,
      },
    });

    let targetStaffIds: string[] = Array.isArray(staffIds) ? staffIds.map(String) : [];
    if (targetStaffIds.length === 0) {
      const allActiveStaff = await prisma.staffProfile.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetStaffIds = allActiveStaff.map((s) => s.id);
    }

    if (targetStaffIds.length > 0) {
      await prisma.staffService.createMany({
        data: targetStaffIds.map((sId: string) => ({
          staffId: sId,
          serviceId: newService.id,
        })),
      });
    }

    return NextResponse.json({ ok: true, service: newService });
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudo crear el servicio.");
  }
}

export async function PUT(req: Request) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireAdmin(
      "Solo el Administrador/Dueño principal puede modificar el catálogo global de servicios y precios."
    );
    if (auth.error) return auth.error;

    const { id, name, description, durationMin, bufferAfterMin, price, isActive, staffIds } =
      await req.json();

    if (!id) {
      return NextResponse.json({ error: "Falta id de servicio" }, { status: 400 });
    }

    if (name !== undefined && String(name).trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre del servicio debe tener al menos 2 caracteres." },
        { status: 400 }
      );
    }

    if (durationMin !== undefined && (Number(durationMin) < 5 || Number(durationMin) > 480)) {
      return NextResponse.json(
        { error: "La duración debe estar entre 5 y 480 minutos." },
        { status: 400 }
      );
    }

    if (bufferAfterMin !== undefined && (Number(bufferAfterMin) < 0 || Number(bufferAfterMin) > 120)) {
      return NextResponse.json(
        { error: "El tiempo de limpieza (buffer) debe estar entre 0 y 120 minutos." },
        { status: 400 }
      );
    }

    if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0 || Number(price) > 100_000)) {
      return NextResponse.json(
        { error: "El precio debe estar entre 0 y 100,000." },
        { status: 400 }
      );
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim().slice(0, 120) : undefined,
        description:
          description !== undefined
            ? description
              ? String(description).trim().slice(0, 400)
              : null
            : undefined,
        durationMin: durationMin !== undefined ? Math.round(Number(durationMin)) : undefined,
        bufferAfterMin:
          bufferAfterMin !== undefined ? Math.round(Number(bufferAfterMin)) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    if (Array.isArray(staffIds)) {
      await prisma.staffService.deleteMany({
        where: { serviceId: id },
      });
      if (staffIds.length > 0) {
        await prisma.staffService.createMany({
          data: staffIds.map((sId: string) => ({
            staffId: String(sId),
            serviceId: id,
          })),
        });
      }
    }

    return NextResponse.json({ ok: true, service: updated });
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudo actualizar el servicio.");
  }
}

// src/app/api/admin/services/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "PROVIDER")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { name, description, durationMin, bufferAfterMin, price, staffIds } =
      await req.json();

    const cleanName = String(name || "").trim();
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

    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json(
        { error: "El precio no puede ser negativo." },
        { status: 400 }
      );
    }

    const newService = await prisma.service.create({
      data: {
        name: cleanName,
        description: description ? String(description).trim() : null,
        durationMin: numDuration,
        bufferAfterMin: numBuffer,
        price: numPrice,
        isActive: true,
      },
    });

    let targetStaffIds: string[] = Array.isArray(staffIds) ? staffIds : [];
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "PROVIDER")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id, name, description, durationMin, bufferAfterMin, price, isActive } =
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

    if (price !== undefined && Number(price) < 0) {
      return NextResponse.json(
        { error: "El precio no puede ser negativo." },
        { status: 400 }
      );
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        description: description !== undefined ? (description ? String(description).trim() : null) : undefined,
        durationMin: durationMin !== undefined ? Number(durationMin) : undefined,
        bufferAfterMin:
          bufferAfterMin !== undefined ? Number(bufferAfterMin) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return NextResponse.json({ ok: true, service: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

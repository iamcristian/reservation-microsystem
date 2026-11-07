// src/app/api/admin/staff/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// Solo el ADMIN (Dueño principal) puede dar de alta, editar o desactivar personal/doctores
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo el Administrador/Dueño principal puede gestionar cuentas del personal." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const displayName = (body.displayName || "").trim();
    const specialtyTitle = (body.specialtyTitle || "Especialista").trim();
    const email = (body.email || "").trim().toLowerCase();
    const phone = (body.phone || "").trim();
    const avatarUrl = (body.avatarUrl || "").trim() || null;

    if (displayName.length < 3) {
      return NextResponse.json(
        { error: "El nombre del profesional debe tener al menos 3 caracteres." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Ingresa un correo de Google válido para vincular la cuenta del profesional." },
        { status: 400 }
      );
    }

    // 1. Crear o actualizar el usuario con rol PROVIDER y contraseña segura
    const initialStaffPassword = await bcrypt.hash(body.password || "Doctor123!", 10);
    let staffUser = await prisma.user.findUnique({ where: { email } });
    if (!staffUser) {
      staffUser = await prisma.user.create({
        data: {
          email,
          name: displayName,
          passwordHash: initialStaffPassword,
          phone: phone || "+591 70000000",
          role: "PROVIDER",
          avatarUrl,
        },
      });
    } else {
      staffUser = await prisma.user.update({
        where: { id: staffUser.id },
        data: {
          role: "PROVIDER",
          name: displayName,
          passwordHash: staffUser.passwordHash || initialStaffPassword,
          phone: phone || staffUser.phone,
        },
      });
    }

    // 2. Crear su StaffProfile y asignarle todos los servicios activos y horarios base Lun-Sáb
    const allServices = await prisma.service.findMany({ where: { isActive: true } });

    const newStaff = await prisma.staffProfile.create({
      data: {
        userId: staffUser.id,
        displayName,
        specialtyTitle,
        avatarUrl:
          avatarUrl ||
          "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80",
        isActive: true,
        services: {
          create: allServices.map((s) => ({
            serviceId: s.id,
          })),
        },
        workingShifts: {
          create: [1, 2, 3, 4, 5, 6].map((day) => ({
            dayOfWeek: day,
            startTime: "09:00",
            endTime: day === 6 ? "13:00" : "18:00",
          })),
        },
      },
      include: {
        user: true,
        workingShifts: true,
      },
    });

    return NextResponse.json({ ok: true, staff: newStaff, user: staffUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "PROVIDER")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      staffId,
      isActive,
      displayName,
      specialtyTitle,
      avatarUrl,
      customHorizonDays,
      customLeadTimeMin,
    } = body;

    if (!staffId) {
      return NextResponse.json({ error: "staffId requerido" }, { status: 400 });
    }

    // Role check: PROVIDER can only edit their own staff profile
    if (user.role === "PROVIDER") {
      const ownStaff = await prisma.staffProfile.findFirst({
        where: { userId: user.id },
      });
      if (!ownStaff || ownStaff.id !== staffId) {
        return NextResponse.json(
          { error: "Solo tienes permisos para modificar tu propio perfil." },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.staffProfile.update({
      where: { id: staffId },
      data: {
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(displayName ? { displayName: displayName.trim() } : {}),
        ...(specialtyTitle ? { specialtyTitle: specialtyTitle.trim() } : {}),
        ...(avatarUrl !== undefined
          ? { avatarUrl: avatarUrl ? avatarUrl.trim() : null }
          : {}),
        ...(customHorizonDays !== undefined
          ? { customHorizonDays: Number(customHorizonDays) }
          : {}),
        ...(customLeadTimeMin !== undefined
          ? { customLeadTimeMin: Number(customLeadTimeMin) }
          : {}),
      },
      include: {
        user: true,
        workingShifts: true,
      },
    });

    return NextResponse.json({ ok: true, staff: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo el Administrador/Dueño puede revocar accesos de personal." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");
    if (!staffId) {
      return NextResponse.json({ error: "staffId requerido" }, { status: 400 });
    }

    const profile = await prisma.staffProfile.findUnique({ where: { id: staffId } });
    if (!profile) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    await prisma.staffProfile.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    if (profile.userId && profile.userId !== user.id) {
      await prisma.user.update({
        where: { id: profile.userId },
        data: { role: "CUSTOMER" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

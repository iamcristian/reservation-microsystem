// src/app/api/admin/staff/route.ts
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  requireStaffOrAdmin,
  safeErrorResponse,
  sanitizeUserForClient,
  verifyProviderOwnsStaff,
  verifySameOrigin,
} from "@/lib/api-guard";
import {
  clampInt,
  normalizeEmail,
  sanitizeImageOrDataUrl,
} from "@/lib/validation/input-validators";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const DEFAULT_STAFF_AVATAR =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80";

// Solo el ADMIN (Dueño principal) puede dar de alta o revocar personal/doctores
export async function POST(req: Request) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireAdmin(
      "Solo el Administrador/Dueño principal puede gestionar cuentas del personal."
    );
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    const displayName = String(body.displayName || "").trim().slice(0, 120);
    const specialtyTitle = String(body.specialtyTitle || "Especialista").trim().slice(0, 120);
    const email = normalizeEmail(body.email);
    const phone = String(body.phone || "").trim().slice(0, 40);

    const avatarCheck = sanitizeImageOrDataUrl(body.avatarUrl);
    if (!avatarCheck.ok) {
      return NextResponse.json({ error: avatarCheck.error }, { status: 400 });
    }
    const avatarUrl = avatarCheck.value;

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

    // Generate cryptographically random initial password when omitted (avoid hardcoded defaults)
    const rawPassword =
      typeof body.password === "string" && body.password.trim().length >= 6
        ? body.password.trim()
        : randomBytes(12).toString("base64url");
    const initialStaffPassword = await bcrypt.hash(rawPassword, 10);

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
      const existingProfile = await prisma.staffProfile.findUnique({
        where: { userId: staffUser.id },
      });
      if (existingProfile) {
        return NextResponse.json(
          { error: "Este correo ya pertenece a un profesional registrado en el equipo." },
          { status: 409 }
        );
      }

      // Never demote an existing ADMIN account to PROVIDER
      staffUser = await prisma.user.update({
        where: { id: staffUser.id },
        data: {
          role: staffUser.role === "ADMIN" ? "ADMIN" : "PROVIDER",
          name: displayName,
          passwordHash: staffUser.passwordHash || initialStaffPassword,
          phone: phone || staffUser.phone,
        },
      });
    }

    const allServices = await prisma.service.findMany({ where: { isActive: true } });
    const validIdSet = new Set(allServices.map((s) => s.id));
    const targetServiceIds: string[] = Array.isArray(body.serviceIds)
      ? body.serviceIds.map(String).filter((id: string) => validIdSet.has(id))
      : allServices.map((s) => s.id);

    const newStaff = await prisma.staffProfile.create({
      data: {
        userId: staffUser.id,
        displayName,
        specialtyTitle,
        avatarUrl: avatarUrl || DEFAULT_STAFF_AVATAR,
        isActive: true,
        services: {
          create: targetServiceIds.map((serviceId) => ({
            serviceId,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            avatarUrl: true,
          },
        },
        services: true,
        workingShifts: true,
      },
    });

    return NextResponse.json({
      ok: true,
      staff: newStaff,
      user: sanitizeUserForClient(staffUser),
    });
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudo registrar al profesional.");
  }
}

export async function PATCH(req: Request) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireStaffOrAdmin();
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const {
      staffId,
      isActive,
      displayName,
      specialtyTitle,
      avatarUrl,
      customHorizonDays,
      customLeadTimeMin,
      serviceIds,
    } = body;

    if (!staffId || typeof staffId !== "string") {
      return NextResponse.json({ error: "staffId requerido" }, { status: 400 });
    }

    const ownershipErr = await verifyProviderOwnsStaff(user, staffId);
    if (ownershipErr) return ownershipErr;

    let validatedAvatar: string | null | undefined = undefined;
    if (avatarUrl !== undefined) {
      const avatarCheck = sanitizeImageOrDataUrl(avatarUrl);
      if (!avatarCheck.ok) {
        return NextResponse.json({ error: avatarCheck.error }, { status: 400 });
      }
      validatedAvatar = avatarCheck.value;
    }

    if (Array.isArray(serviceIds)) {
      const validServices = await prisma.service.findMany({
        where: { id: { in: serviceIds.map(String) } },
        select: { id: true },
      });
      const validIds = validServices.map((s) => s.id);
      await prisma.staffService.deleteMany({
        where: { staffId },
      });
      if (validIds.length > 0) {
        await prisma.staffService.createMany({
          data: validIds.map((svcId: string) => ({
            staffId,
            serviceId: svcId,
          })),
        });
      }
    }

    const updated = await prisma.staffProfile.update({
      where: { id: staffId },
      data: {
        ...(isActive !== undefined && user.role === "ADMIN"
          ? { isActive: Boolean(isActive) }
          : {}),
        ...(typeof displayName === "string" && displayName.trim().length >= 2
          ? { displayName: displayName.trim().slice(0, 120) }
          : {}),
        ...(typeof specialtyTitle === "string" && specialtyTitle.trim().length >= 2
          ? { specialtyTitle: specialtyTitle.trim().slice(0, 120) }
          : {}),
        ...(validatedAvatar !== undefined ? { avatarUrl: validatedAvatar } : {}),
        ...(customHorizonDays !== undefined
          ? {
              customHorizonDays:
                customHorizonDays === null
                  ? null
                  : clampInt(customHorizonDays, 1, 90, 7),
            }
          : {}),
        ...(customLeadTimeMin !== undefined
          ? {
              customLeadTimeMin:
                customLeadTimeMin === null
                  ? null
                  : clampInt(customLeadTimeMin, 0, 1440, 30),
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            avatarUrl: true,
          },
        },
        services: true,
        workingShifts: true,
      },
    });

    return NextResponse.json({ ok: true, staff: updated });
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudo actualizar el perfil del profesional.");
  }
}

export async function DELETE(req: Request) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireAdmin(
      "Solo el Administrador/Dueño puede revocar accesos de personal."
    );
    if (auth.error) return auth.error;
    const { user } = auth;

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
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudo revocar el acceso del personal.");
  }
}

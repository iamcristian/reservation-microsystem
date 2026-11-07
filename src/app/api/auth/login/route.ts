// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionUserId } from "@/lib/session";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Debes ingresar tu correo electrónico." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Debes ingresar tu contraseña." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        staffProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No existe una cuenta registrada con este correo." },
        { status: 401 }
      );
    }

    // Verify role permissions if accessing staff panel
    if (role === "STAFF" || role === "ADMIN" || role === "PROVIDER") {
      if (user.role !== "ADMIN" && user.role !== "PROVIDER") {
        return NextResponse.json(
          {
            error:
              "Esta cuenta no tiene permisos de profesional o administrador.",
          },
          { status: 403 }
        );
      }
    }

    // Check password
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta no tiene contraseña asignada. Contacta al administrador para restablecerla.",
        },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Contraseña incorrecta. Por favor intenta nuevamente." },
        { status: 401 }
      );
    }

    await setSessionUserId(user.id);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}

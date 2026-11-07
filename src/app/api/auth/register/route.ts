// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionUserId } from "@/lib/session";
import {
  consumeRateLimit,
  getClientIp,
  tooManyRequestsBody,
} from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP = 15;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = consumeRateLimit(`register:ip:${ip}`, MAX_REGISTRATIONS_PER_IP, REGISTER_WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(tooManyRequestsBody(rate.retryAfterSec), {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { name, email, password, phone } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Por favor ingresa tu nombre completo (mínimo 2 letras)." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Por favor ingresa un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "Ya existe una cuenta con este correo electrónico. Por favor inicia sesión con tu contraseña.",
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        phone: phone ? phone.trim() : null,
        role: "CUSTOMER",
      },
    });

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
    console.error("Register error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al registrar usuario" },
      { status: 500 }
    );
  }
}

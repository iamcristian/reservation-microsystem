// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionUserId, clearImpersonator } from "@/lib/session";
import {
  consumeRateLimit,
  peekRateLimit,
  resetRateLimit,
  getClientIp,
  tooManyRequestsBody,
} from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// Generic message for every credential failure (prevents user enumeration).
const INVALID_CREDENTIALS = "Correo o contraseña incorrectos. Por favor verifica tus datos.";

// Valid bcrypt hash (same cost factor) used to keep response time constant when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", 10);

// Brute-force limits on FAILED attempts
const MAX_FAILS_PER_ACCOUNT = 5; // per IP+email
const MAX_FAILS_PER_IP = 20; // across all emails from one IP
const FAIL_WINDOW_MS = 15 * 60 * 1000;

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
    const ip = getClientIp(req);
    const accountKey = `login-fail:${ip}:${cleanEmail}`;
    const ipKey = `login-fail-ip:${ip}`;

    const accountGate = peekRateLimit(accountKey, MAX_FAILS_PER_ACCOUNT);
    const ipGate = peekRateLimit(ipKey, MAX_FAILS_PER_IP);
    if (!accountGate.allowed || !ipGate.allowed) {
      const retry = Math.max(accountGate.retryAfterSec, ipGate.retryAfterSec);
      return NextResponse.json(tooManyRequestsBody(retry), {
        status: 429,
        headers: { "Retry-After": String(retry) },
      });
    }

    const registerFailure = () => {
      consumeRateLimit(accountKey, MAX_FAILS_PER_ACCOUNT, FAIL_WINDOW_MS);
      consumeRateLimit(ipKey, MAX_FAILS_PER_IP, FAIL_WINDOW_MS);
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    };

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Always run bcrypt so existing and non-existing accounts take the same time.
    const isMatch = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);

    if (!user || !user.passwordHash || !isMatch) {
      return registerFailure();
    }

    // Role gate is evaluated only AFTER valid credentials, so it reveals nothing to attackers.
    if (role === "STAFF" || role === "ADMIN" || role === "PROVIDER") {
      if (user.role !== "ADMIN" && user.role !== "PROVIDER") {
        return NextResponse.json(
          { error: "Esta cuenta no tiene permisos de profesional o administrador." },
          { status: 403 }
        );
      }
    }

    resetRateLimit(accountKey);
    await clearImpersonator();
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
    return NextResponse.json({ error: "Error al iniciar sesión" }, { status: 500 });
  }
}

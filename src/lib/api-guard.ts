// src/lib/api-guard.ts
import { NextResponse } from "next/server";
import { User } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * Rejects cross-origin state-mutating requests (defense-in-depth alongside SameSite=Lax cookies).
 * Returns null if allowed, or a 403 NextResponse if Origin mismatches Host.
 */
export function verifySameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;

  const rawHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!rawHost) return null;

  const expectedHost = rawHost.split(",")[0].trim().toLowerCase();
  try {
    const originHost = new URL(origin).host.toLowerCase();
    if (originHost !== expectedHost) {
      return NextResponse.json(
        { error: "Origen de solicitud no autorizado." },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Encabezado Origin inválido." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Ensures the request has an authenticated user session.
 */
export async function requireAuth(): Promise<
  { user: User; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }
  return { user };
}

/**
 * Ensures the authenticated user has role ADMIN or PROVIDER.
 */
export async function requireStaffOrAdmin(): Promise<
  { user: User; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVIDER")) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { user };
}

/**
 * Ensures the authenticated user is the primary ADMIN.
 */
export async function requireAdmin(
  message = "Solo el Administrador/Dueño principal puede realizar esta acción."
): Promise<{ user: User; error?: never } | { user?: never; error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: message }, { status: 403 }),
    };
  }
  return { user };
}

/**
 * Checks whether a PROVIDER owns the target staffId. ADMIN always passes.
 */
export async function verifyProviderOwnsStaff(
  user: User,
  staffId: string
): Promise<NextResponse | null> {
  if (user.role === "ADMIN") return null;
  const ownStaff = await prisma.staffProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!ownStaff || ownStaff.id !== staffId) {
    return NextResponse.json(
      { error: "Solo tienes permisos para gestionar tu propia agenda o perfil." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Strips credential fields and internal notes before sending User objects to the browser.
 */
export function sanitizeUserForClient<T extends Record<string, unknown>>(user: T) {
  const cleaned = { ...user };
  delete cleaned.passwordHash;
  delete cleaned.googleId;
  delete cleaned.adminNotes;
  return cleaned;
}

/**
 * Logs unexpected server errors internally without leaking database/Prisma traces to clients.
 */
export function safeErrorResponse(
  error: unknown,
  fallbackMessage = "Ocurrió un error interno. Intenta nuevamente.",
  status = 500
): NextResponse {
  console.error(`[API Error ${status}]:`, error);
  return NextResponse.json({ error: fallbackMessage }, { status });
}

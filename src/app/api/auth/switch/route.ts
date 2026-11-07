// src/app/api/auth/switch/route.ts
// "Preview as staff" impersonation. Only an ADMIN can start it, and the only way
// back is to the ADMIN recorded in the signed impersonator cookie.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  setSessionUserId,
  getImpersonatorId,
  setImpersonatorId,
  clearImpersonator,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "Falta el usuario destino (userId)." }, { status: 400 });
    }

    const impersonatorId = await getImpersonatorId();

    // Case 1: an impersonating session returns to the original ADMIN.
    if (impersonatorId && userId === impersonatorId) {
      const admin = await prisma.user.findUnique({ where: { id: impersonatorId } });
      if (!admin || admin.role !== "ADMIN") {
        await clearImpersonator();
        return NextResponse.json({ error: "No autorizado." }, { status: 403 });
      }
      await clearImpersonator();
      await setSessionUserId(admin.id);
      return NextResponse.json({ ok: true, user: publicUser(admin) });
    }

    // Case 2: start a preview. Only the real ADMIN may do this (PROVIDER/CUSTOMER cannot escalate).
    const actingAdminId = currentUser.role === "ADMIN" ? currentUser.id : null;
    if (!actingAdminId) {
      return NextResponse.json(
        { error: "No autorizado para cambiar de sesión de personal." },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    // Previews are restricted to staff accounts; never into customers or other admins.
    if (targetUser.role !== "PROVIDER" && targetUser.id !== actingAdminId) {
      return NextResponse.json(
        { error: "Solo se puede previsualizar la sesión de un profesional del equipo." },
        { status: 403 }
      );
    }

    if (targetUser.id === actingAdminId) {
      await clearImpersonator();
    } else {
      await setImpersonatorId(actingAdminId);
    }
    await setSessionUserId(targetUser.id);
    return NextResponse.json({ ok: true, user: publicUser(targetUser) });
  } catch (error: any) {
    console.error("Session switch error:", error);
    return NextResponse.json({ error: "Error al cambiar de sesión" }, { status: 500 });
  }
}

function publicUser(u: { id: string; name: string | null; email: string; role: string }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

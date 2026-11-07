// src/app/api/auth/switch/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "PROVIDER")) {
      return NextResponse.json(
        { error: "No autorizado para cambiar de sesión de personal." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { userId, email, name, phone } = body;

    let targetUser;

    if (userId) {
      targetUser = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      targetUser = await prisma.user.upsert({
        where: { email: email.trim().toLowerCase() },
        update: { name: name || undefined },
        create: {
          email: email.trim().toLowerCase(),
          googleId: `google_${Date.now()}`,
          name: name || "Nuevo Usuario",
          phone: phone || null,
          role: "CUSTOMER",
        },
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    await setSessionUserId(targetUser.id);
    return NextResponse.json({ ok: true, user: targetUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

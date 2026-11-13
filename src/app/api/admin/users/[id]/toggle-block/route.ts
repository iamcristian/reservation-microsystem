// src/app/api/admin/users/[id]/toggle-block/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  safeErrorResponse,
  sanitizeUserForClient,
  verifySameOrigin,
} from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originErr = verifySameOrigin(req);
    if (originErr) return originErr;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (targetUser.role === "ADMIN") {
      return NextResponse.json(
        { error: "No se puede bloquear la cuenta del Administrador principal." },
        { status: 400 }
      );
    }

    let newBlockedState =
      body.isBlocked !== undefined ? Boolean(body.isBlocked) : !targetUser.isBlocked;

    const shouldArchiveAndResetStrikes =
      Boolean(body.resetNoShows) || (targetUser.isBlocked && !newBlockedState);

    let nextNoShowCount: number | undefined = undefined;
    if (shouldArchiveAndResetStrikes) {
      nextNoShowCount = 0;
      newBlockedState = false;
      // Archivar las inasistencias del ciclo anterior para que pasen al historial del cliente
      await prisma.appointment.updateMany({
        where: {
          customerId: id,
          status: "NO_SHOW",
        },
        data: {
          status: "NO_SHOW_ARCHIVED",
        },
      });
    } else if (body.incrementNoShow) {
      nextNoShowCount = targetUser.noShowCount + 1;
      if (nextNoShowCount >= 2) {
        newBlockedState = true;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isBlocked: newBlockedState,
        adminNotes:
          body.adminNotes !== undefined
            ? typeof body.adminNotes === "string"
              ? body.adminNotes.trim().slice(0, 500)
              : null
            : undefined,
        noShowCount: nextNoShowCount,
        completedCount:
          body.incrementCompleted ? targetUser.completedCount + 1 : undefined,
      },
    });

    return NextResponse.json({ ok: true, user: sanitizeUserForClient(updated) });
  } catch (error: unknown) {
    return safeErrorResponse(error, "No se pudo actualizar el estado del cliente.");
  }
}

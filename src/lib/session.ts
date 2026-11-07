// src/lib/session.ts
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "reserva_user_id";

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    return user;
  } catch (error) {
    console.error("Error retrieving session user:", error);
    return null;
  }
}

export async function setSessionUserId(userId: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, userId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch (error) {
    console.error("Error setting session cookie:", error);
  }
}

export async function clearSessionUser() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    console.error("Error clearing session cookie:", error);
  }
}

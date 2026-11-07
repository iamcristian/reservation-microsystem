// src/lib/session.ts
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "reserva_session";
// Signed marker of the ADMIN who started an impersonation ("preview as staff") session
export const IMPERSONATOR_COOKIE_NAME = "reserva_impersonator";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const DEV_FALLBACK_SECRET = "dev-only-insecure-session-secret-change-me";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET env var is missing or shorter than 32 chars. Refusing to issue sessions in production."
    );
  }
  return DEV_FALLBACK_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

/**
 * Token format: base64url(userId).expiresAtEpochSec.signature
 * The signature covers userId + expiry, so neither can be tampered with.
 */
export function createSessionToken(userId: string, maxAgeSec = SESSION_MAX_AGE_SEC): string {
  const expiresAt = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = `${Buffer.from(userId).toString("base64url")}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedId, expiresAtStr, signature] = parts;
  const payload = `${encodedId}.${expiresAtStr}`;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  try {
    return Buffer.from(encodedId, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const userId = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!userId) return null;

    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (error) {
    console.error("Error retrieving session user:", error);
    return null;
  }
}

export async function setSessionUserId(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(userId), cookieOptions());
}

export async function clearSessionUser() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete(IMPERSONATOR_COOKIE_NAME);
  } catch (error) {
    console.error("Error clearing session cookie:", error);
  }
}

/** Returns the ADMIN user id that started the current impersonation, if any (signature-verified). */
export async function getImpersonatorId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value);
}

export async function setImpersonatorId(adminUserId: string) {
  const cookieStore = await cookies();
  const maxAge = 60 * 60 * 8; // impersonation windows expire after 8h
  cookieStore.set(IMPERSONATOR_COOKIE_NAME, createSessionToken(adminUserId, maxAge), cookieOptions(maxAge));
}

export async function clearImpersonator() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATOR_COOKIE_NAME);
}

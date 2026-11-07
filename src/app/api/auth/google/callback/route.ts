// src/app/api/auth/google/callback/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateStr = searchParams.get("state");
    const error = searchParams.get("error");

    let returnTo = "/";
    if (stateStr) {
      try {
        const parsed = JSON.parse(decodeURIComponent(stateStr));
        if (
          typeof parsed.returnTo === "string" &&
          parsed.returnTo.startsWith("/") &&
          !parsed.returnTo.startsWith("//") &&
          !parsed.returnTo.includes("\\")
        ) {
          returnTo = parsed.returnTo;
        }
      } catch (e) {
        console.error("State parse error:", e);
      }
    }

    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(`${getBaseUrl(req)}${returnTo}?authError=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${getBaseUrl(req)}${returnTo}?authError=no_code`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${getBaseUrl(req)}${returnTo}?authError=missing_google_credentials`);
    }

    // 1. Intercambiar authorization code por access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return NextResponse.redirect(`${getBaseUrl(req)}${returnTo}?authError=token_exchange_failed`);
    }

    // 2. Obtener perfil del usuario desde Google
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await userinfoResponse.json();

    if (!profile.email) {
      return NextResponse.redirect(`${getBaseUrl(req)}${returnTo}?authError=no_email_provided`);
    }

    const cleanEmail = profile.email.toLowerCase();

    // 3. Vincular o crear usuario en la base de datos
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user) {
      // Si ya existía, actualizar su googleId y avatar si hace falta
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.sub,
          avatarUrl: profile.picture || user.avatarUrl,
          name: user.name || profile.name,
        },
      });
    } else {
      // Nuevo usuario verificado con Google
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          googleId: profile.sub,
          name: profile.name || cleanEmail.split("@")[0],
          avatarUrl: profile.picture,
          role: "CUSTOMER",
        },
      });
    }

    // 4. Crear cookie de sesión segura
    await setSessionUserId(user.id);

    // 5. Redireccionar según el rol
    if (user.role === "ADMIN" || user.role === "PROVIDER") {
      // Si es doctor o admin, llevarlo a su panel de gestión
      return NextResponse.redirect(`${getBaseUrl(req)}/admin`);
    }

    return NextResponse.redirect(`${getBaseUrl(req)}${returnTo}`);
  } catch (error: any) {
    console.error("Google callback error:", error);
    return NextResponse.redirect(`${getBaseUrl(req)}/?authError=${encodeURIComponent(error.message)}`);
  }
}

// src/app/api/auth/google/callback/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSafeBaseUrl,
  setSessionUserId,
  verifyAndConsumeOAuthState,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const baseUrl = getSafeBaseUrl(req);
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateStr = searchParams.get("state");
    const error = searchParams.get("error");

    const { valid: isStateValid, returnTo } = await verifyAndConsumeOAuthState(stateStr);

    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        `${baseUrl}${returnTo}?authError=${encodeURIComponent(error)}`
      );
    }

    if (!isStateValid) {
      return NextResponse.redirect(
        `${baseUrl}${returnTo}?authError=invalid_oauth_state`
      );
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}${returnTo}?authError=no_code`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}${returnTo}?authError=missing_google_credentials`
      );
    }

    // 1. Exchange authorization code for access token
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
      return NextResponse.redirect(
        `${baseUrl}${returnTo}?authError=token_exchange_failed`
      );
    }

    // 2. Fetch user profile from Google
    const userinfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    const profile = await userinfoResponse.json();

    if (!profile.email || profile.email_verified === false) {
      return NextResponse.redirect(
        `${baseUrl}${returnTo}?authError=email_not_verified`
      );
    }

    const cleanEmail = profile.email.toLowerCase();

    // 3. Link or create user in database
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.sub,
          avatarUrl: profile.picture || user.avatarUrl,
          name: user.name || profile.name,
        },
      });
    } else {
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

    // 4. Issue signed session cookie
    await setSessionUserId(user.id);

    // 5. Redirect based on role
    if (user.role === "ADMIN" || user.role === "PROVIDER") {
      return NextResponse.redirect(`${baseUrl}/admin`);
    }

    return NextResponse.redirect(`${baseUrl}${returnTo}`);
  } catch (error: unknown) {
    console.error("Google callback error:", error);
    return NextResponse.redirect(`${baseUrl}/?authError=oauth_callback_failed`);
  }
}

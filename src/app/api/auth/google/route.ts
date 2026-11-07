// src/app/api/auth/google/route.ts
import { NextResponse } from "next/server";

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
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get("returnTo") || "/";

  const clientId = process.env.GOOGLE_CLIENT_ID;

  // Si no se han configurado las claves de Google Cloud Console en .env
  if (!clientId || clientId.trim().length === 0 || clientId.includes("TU_GOOGLE_CLIENT_ID")) {
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Configuración de Google OAuth Requerida</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-[#EBEBEF] min-h-screen flex items-center justify-center p-4 text-[#1F1F23]">
        <div class="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-zinc-200 space-y-5">
          <div class="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-md mx-auto">
            G
          </div>
          <div class="text-center space-y-1">
            <h1 class="text-lg font-bold text-zinc-900">Configuración de Google OAuth</h1>
            <p class="text-xs text-zinc-500">
              Para habilitar el inicio de sesión real con Google, agrega tus credenciales en el archivo <code>.env</code>
            </p>
          </div>

          <div class="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs space-y-2 text-zinc-700">
            <div class="font-bold text-zinc-900">Pasos rápidos en Google Cloud Console:</div>
            <ol class="list-decimal list-inside space-y-1 text-zinc-600">
              <li>Crea un proyecto en <a href="https://console.cloud.google.com" target="_blank" class="text-blue-600 underline">console.cloud.google.com</a>.</li>
              <li>Ve a <b>APIs & Services → Credentials</b>.</li>
              <li>Crea una <b>OAuth 2.0 Client ID (Web Application)</b>.</li>
              <li>Agrega en <b>Authorized Redirect URIs</b>:
                <code class="block mt-1 bg-white p-2 rounded-lg border border-zinc-300 font-mono text-[11px] text-zinc-800 break-all select-all">
                  ${getBaseUrl(req)}/api/auth/google/callback
                </code>
              </li>
              <li>Copia las credenciales a tu archivo <code>.env</code>:
                <pre class="mt-1 bg-zinc-900 text-emerald-400 p-2.5 rounded-lg text-[11px] overflow-x-auto">GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-client-secret"</pre>
              </li>
            </ol>
          </div>

          <div class="pt-2 flex flex-col gap-2">
            <a href="${returnTo}" class="w-full py-3 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold text-center transition-all shadow-md">
              ← Volver a la aplicación
            </a>
          </div>
        </div>
      </body>
      </html>
    `;
    return new Response(errorHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 200,
    });
  }

  // Redirigir a la pantalla de consentimiento de Google OAuth 2.0
  const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
  const state = encodeURIComponent(JSON.stringify({ returnTo }));

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(googleAuthUrl.toString());
}

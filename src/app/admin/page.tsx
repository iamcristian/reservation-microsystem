"use client";

import React, { useState, useEffect } from "react";
import { AdminApp } from "@/components/AdminApp";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Stethoscope,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch("/api/bootstrap");
      if (!res.ok) {
        console.error("Bootstrap HTTP status:", res.status);
      }
      const json = await res.json().catch(() => null);
      if (json) {
        setData(json);
      }
    } catch (e) {
      console.error("Error loading bootstrap data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStaffLogin = async (targetEmail: string, targetPassword?: string) => {
    setLoginLoading(true);
    setLoginError(null);
    const pass = targetPassword || passwordInput;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail.trim(),
          password: pass,
          role: "STAFF",
        }),
      });
      const resJson = await res.json().catch(() => ({ error: "Error en la respuesta" }));
      if (!res.ok) {
        setLoginError(resJson.error || "No fue posible iniciar sesión.");
        return;
      }
      await loadData();
    } catch (e: any) {
      setLoginError(e.message || "Error al conectar con el servidor");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EBEBEF]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1F1F23] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-zinc-600">
            Cargando panel de gestión...
          </span>
        </div>
      </div>
    );
  }

  const currentUser = data?.currentUser;
  const isAuthorized =
    currentUser &&
    (currentUser.role === "ADMIN" || currentUser.role === "PROVIDER");

  // If not authenticated as Admin or Provider, show Login Screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#EBEBEF] p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-zinc-200 p-8 space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1F1F23] text-white flex items-center justify-center shadow-md">
              <Lock className="w-7 h-7" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-zinc-900">
              Panel de Profesionales y Administración
            </h1>
            <p className="text-xs text-zinc-500">
              {data?.settings?.name || "Clínica & Reservas"} • Acceso restringido a personal autorizado
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {loginError}
            </div>
          )}

          {/* Google Sign-In para Staff */}
          <a
            href="/api/auth/google?returnTo=/admin"
            className="w-full py-3 px-4 rounded-full bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold border border-zinc-300 shadow-sm flex items-center justify-center gap-2.5 transition-all"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Iniciar Sesión con Google (Staff)</span>
          </a>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[10px] text-zinc-400 font-semibold uppercase">
              O con credenciales del sistema
            </span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (emailInput && passwordInput) handleStaffLogin(emailInput, passwordInput);
            }}
            className="space-y-4"
          >
            <div className="border border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2.5">
              <label className="text-xs text-zinc-500 block font-medium">
                Correo Electrónico Autorizado
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="ejemplo@sonrisa.com"
                className="bg-transparent font-semibold text-sm text-[#1F1F23] focus:outline-none w-full mt-0.5"
              />
            </div>

            <div className="border border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2.5 relative">
              <label className="text-xs text-zinc-500 block font-medium">
                Contraseña Privada
              </label>
              <div className="flex items-center justify-between">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent font-semibold text-sm text-[#1F1F23] focus:outline-none w-full mt-0.5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-zinc-400 hover:text-zinc-700 ml-2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading || !emailInput || !passwordInput}
              className="w-full py-3.5 rounded-full bg-[#1F1F23] text-white text-xs font-bold hover:bg-black transition-all shadow-md disabled:opacity-50"
            >
              {loginLoading ? "Verificando credenciales..." : "Ingresar al Panel"}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-black transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la vista de reservas para clientes</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin / Provider Dashboard View
  return (
    <div className="min-h-screen flex flex-col bg-[#EBEBEF]">
      {/* Top Professional Header Bar */}
      <header className="bg-[#1F1F23] text-white text-xs px-4 py-2.5 flex items-center justify-between z-50 sticky top-0 shadow-md">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-tight text-white hidden sm:inline">
            {data?.settings?.name || "Clínica & Reservas"}
          </span>
          <span className="hidden sm:inline text-zinc-500">|</span>
          <div className="flex items-center gap-2">
            {currentUser.role === "ADMIN" ? (
              <Shield className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="font-semibold">{currentUser.name}</span>
            <span className="bg-white/10 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {currentUser.role === "ADMIN"
                ? "Administrador"
                : data?.settings?.staffLabel || "Doctor(a)"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === "ADMIN" && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1 rounded-full text-[11px] transition-all"
              title="Ver cómo los pacientes ven el portal de reservas públicas"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Ver Portal Clientes</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            title="Cerrar Sesión"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Main Admin Application */}
      <main className="flex-1 w-full pb-10">
        <AdminApp initialData={data} onRefresh={loadData} />
      </main>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowRight } from "lucide-react";
import { ClientApp } from "@/components/ClientApp";
import type { BootstrapPayload } from "@/lib/bootstrap";

interface HomeClientProps {
  initialData: BootstrapPayload | null;
}

export function HomeClient({ initialData }: HomeClientProps) {
  const router = useRouter();
  const [data, setData] = useState<BootstrapPayload | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        return loadData();
      }
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  // Role Invariant: If authenticated user is a specialist (PROVIDER), their workspace is /admin.
  // Doctors are redirected to the management panel and cannot book appointments as customers.
  useEffect(() => {
    if (data?.currentUser?.role === "PROVIDER") {
      router.replace("/admin");
    }
  }, [data, router]);

  if (loading || data?.currentUser?.role === "PROVIDER") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EBEBEF]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1F1F23] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-zinc-600">
            {data?.currentUser?.role === "PROVIDER"
              ? "Redirigiendo a tu Agenda Profesional de Doctor(a)..."
              : "Cargando sistema de reservas..."}
          </span>
        </div>
      </div>
    );
  }

  const isAdminOwner = data?.currentUser?.role === "ADMIN";

  return (
    <div className="min-h-dvh flex flex-col bg-[#EBEBEF]">
      {/* Banner de Modo Vista Previa / Auditoría solo para el Administrador Dueño */}
      {isAdminOwner && (
        <div className="bg-[#1F1F23] text-white text-xs px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-50 sticky top-0 shadow-md">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-zinc-300 leading-snug">
              <b>Modo Vista Previa (Admin):</b>{" "}
              <span className="hidden sm:inline">Así es como tus clientes ven el portal de reservas públicas.</span>
              <span className="sm:hidden">Vista pública para tus clientes.</span>
            </span>
          </div>
          <Link
            href="/admin"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-white text-zinc-900 font-bold px-3 py-1.5 rounded-full text-[11px] hover:bg-zinc-200 transition-all whitespace-nowrap shrink-0"
          >
            <span>Volver a Administración</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Flujo de Reserva para Clientes */}
      <main className="flex-1 w-full py-0 md:py-8 md:px-6 flex flex-col items-center justify-start">
        <ClientApp initialData={data} onRefresh={loadData} />
      </main>
    </div>
  );
}

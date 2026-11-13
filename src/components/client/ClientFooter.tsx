"use client";

import React from "react";
import Link from "next/link";

interface ClientFooterProps {
  businessName?: string | null;
  addressText?: string | null;
  isHealthBusiness: boolean;
}

export function ClientFooter({
  businessName,
  addressText,
  isHealthBusiness,
}: ClientFooterProps) {
  return (
    <footer className="mt-auto px-5 md:px-8 py-6 md:py-7 text-center border-t border-zinc-200/80 bg-zinc-50/50 text-xs text-zinc-500 space-y-2.5 md:rounded-b-[32px]">
      <div className="space-y-0.5">
        <p className="font-semibold text-zinc-700">
          {businessName || "Clínica & Reservas"}
        </p>
        <p className="text-[11px] text-zinc-400">
          {addressText || "Atención con cita previa"}
        </p>
      </div>

      <p className="text-[11px] text-zinc-400 max-w-md mx-auto leading-relaxed">
        {isHealthBusiness
          ? "Agenda digital sujeta a disponibilidad y confirmación. Precios referenciales sujetos a valoración presencial. Este portal no atiende emergencias médicas ni urgencias vitales."
          : "Agenda digital sujeta a disponibilidad y confirmación. Precios referenciales sujetos a evaluación presencial."}
      </p>

      <nav
        aria-label="Enlaces legales"
        className="pt-1 flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-zinc-600"
      >
        <Link
          href="/terminos"
          className="py-1 px-1 hover:text-zinc-900 underline transition-colors"
        >
          Términos y Condiciones
        </Link>
        <span aria-hidden="true" className="text-zinc-300">
          •
        </span>
        <Link
          href="/terminos#cancelaciones"
          className="py-1 px-1 hover:text-zinc-900 underline transition-colors"
        >
          Cancelaciones
        </Link>
        <span aria-hidden="true" className="text-zinc-300">
          •
        </span>
        <Link
          href="/privacidad"
          className="py-1 px-1 hover:text-zinc-900 underline transition-colors"
        >
          Política de Privacidad
        </Link>
        <span aria-hidden="true" className="text-zinc-300">
          •
        </span>
        <Link
          href="/cookies"
          className="py-1 px-1 hover:text-zinc-900 underline transition-colors"
        >
          Cookies
        </Link>
      </nav>

      <div className="pt-2 border-t border-zinc-200/60 flex flex-col items-center gap-1">
        <p className="text-[10px] text-zinc-400">
          © {new Date().getFullYear()} {businessName || "Clínica & Reservas"}. Todos los derechos reservados.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 py-1.5 px-3 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 underline transition-all"
        >
          <span>Acceso para Profesionales y Administración</span>
          <span>→</span>
        </Link>
      </div>
    </footer>
  );
}

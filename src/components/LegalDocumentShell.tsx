import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, Cookie } from "lucide-react";
import type { LegalContext } from "@/lib/legal";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

interface LegalDocumentShellProps {
  context: LegalContext;
  activeSlug: "terminos" | "privacidad" | "cookies";
  title: string;
  subtitle: string;
  summaryPoints: string[];
  children: React.ReactNode;
}

const LEGAL_TABS = [
  { slug: "terminos" as const, href: "/terminos", label: "Términos y Condiciones", Icon: FileText },
  { slug: "privacidad" as const, href: "/privacidad", label: "Política de Privacidad", Icon: ShieldCheck },
  { slug: "cookies" as const, href: "/cookies", label: "Política de Cookies", Icon: Cookie },
];

/**
 * Shared responsive shell for public legal pages, matching the portal theme
 * while highlighting plain-language summaries and direct return to booking.
 */
export function LegalDocumentShell({
  context,
  activeSlug,
  title,
  subtitle,
  summaryPoints,
  children,
}: LegalDocumentShellProps) {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-dvh bg-[#EBEBEF] py-0 md:py-8 md:px-6">
      <div className="w-full max-w-3xl mx-auto bg-white md:rounded-[32px] md:shadow-xl md:border md:border-zinc-200/80 min-h-dvh md:min-h-0 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="px-4 sm:px-8 py-4 sm:py-5 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0 group">
            {context.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={context.logoUrl}
                alt={context.businessName}
                className="w-10 h-10 rounded-full object-cover border border-zinc-200 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1F1F23] text-white font-bold text-sm flex items-center justify-center shrink-0">
                {context.businessName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm text-[#1F1F23] truncate group-hover:underline">
                {context.businessName}
              </div>
              <div className="text-[11px] text-zinc-500 truncate">{context.locality}</div>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold transition-all shadow-xs shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Reservar</span>
          </Link>
        </header>

        {/* Legal Navigation Pills */}
        <nav
          aria-label="Documentos legales"
          className="px-4 sm:px-8 pt-4 pb-2 flex items-center gap-2 flex-wrap border-b border-zinc-100"
        >
          {LEGAL_TABS.map(({ slug, href, label, Icon }) => {
            const isActive = activeSlug === slug;
            return (
              <Link
                key={slug}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#1F1F23] text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main Document Body */}
        <main className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 flex-1 text-zinc-700">
          <div className="space-y-2">
            <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-semibold">
              <span>Vigente</span>
              <span aria-hidden="true">•</span>
              <span>Actualizado el {context.updatedAtLabel}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1F1F23] tracking-tight">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">{subtitle}</p>
          </div>

          {/* Plain-Language Summary Box */}
          <section
            aria-label="Resumen en lenguaje claro"
            className="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Resumen claro para ti
            </h2>
            <ul className="space-y-1.5 text-xs sm:text-[13px] text-zinc-700 leading-relaxed list-disc pl-4">
              {summaryPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </section>

          <article className="space-y-6 text-xs sm:text-sm leading-relaxed">
            {children}
          </article>
        </main>

        {/* Legal Footer */}
        <footer className="px-4 sm:px-8 py-6 border-t border-zinc-200 bg-zinc-50/80 space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-zinc-900">
                ¿Dudas, reclamos o solicitud sobre tus datos personales?
              </div>
              <p className="text-zinc-500">
                Comunícate directamente con administración en {context.businessName} ({context.addressText}).
              </p>
            </div>
            <a
              href={context.whatsappContactUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold transition-all shadow-xs shrink-0"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>Escribir por WhatsApp</span>
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span>
              © {year} {context.businessName}. Todos los derechos reservados.
            </span>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <Link href="/terminos" className="hover:text-zinc-900 underline">
                Términos
              </Link>
              <Link href="/privacidad" className="hover:text-zinc-900 underline">
                Privacidad
              </Link>
              <Link href="/cookies" className="hover:text-zinc-900 underline">
                Cookies
              </Link>
              <Link href="/" className="hover:text-zinc-900 font-semibold">
                Portal de Reservas
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

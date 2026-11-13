"use client";

import React from "react";
import { MapPin, ShieldAlert, X } from "lucide-react";
import BranchMap from "../BranchMap";
import { WhatsAppIcon } from "../WhatsAppIcon";
import { parseCoordinatesFromUrl } from "@/lib/geo";

interface CancellationPolicyModalProps {
  policyModal: { open: boolean; message: string; whatsappUrl: string } | null;
  onClose: () => void;
}

export function CancellationPolicyModal({
  policyModal,
  onClose,
}: CancellationPolicyModalProps) {
  if (!policyModal?.open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[28px] p-5 sm:p-6 max-w-sm w-full text-center shadow-2xl max-h-[92dvh] overflow-y-auto">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-zinc-900">
          Política de Cancelación
        </h3>
        <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
          {policyModal.message}
        </p>

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <a
            href={policyModal.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-h-[42px] py-3 rounded-full bg-[#1F1F23] text-white text-xs font-semibold hover:bg-black flex items-center justify-center gap-1.5"
          >
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
            <span>Hablar por WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] py-3 px-5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-zinc-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

interface BranchLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string | null;
  addressText?: string | null;
  googleMapsUrl?: string | null;
}

export function BranchLocationModal({
  isOpen,
  onClose,
  businessName,
  addressText,
  googleMapsUrl,
}: BranchLocationModalProps) {
  if (!isOpen) return null;

  const coords = parseCoordinatesFromUrl(googleMapsUrl) ?? {
    lat: -17.3713,
    lng: -66.1742,
  };
  const resolvedAddress = addressText || "Atención presencial con cita previa";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[28px] max-w-sm w-full overflow-hidden shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
              <MapPin className="w-4 h-4 text-rose-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1F1F23] truncate">
                Ubicación de la Sucursal
              </h3>
              <p className="text-[11px] text-zinc-500 truncate">
                {resolvedAddress}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-700 flex items-center justify-center transition-all shrink-0"
            title="Cerrar mapa"
            aria-label="Cerrar mapa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          <BranchMap
            name={businessName || "Mi Negocio"}
            addressText={resolvedAddress}
            lat={coords.lat}
            lng={coords.lng}
            googleMapsUrl={googleMapsUrl || undefined}
            height="240px"
          />
        </div>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  pwaInstalled: boolean;
  onInstallPrompted: () => void;
}

export function PwaInstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  pwaInstalled,
  onInstallPrompted,
}: PwaInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[32px] p-5 sm:p-6 max-w-sm w-full shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#1F1F23] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
              📲
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1F1F23] leading-snug">
                Instalar como Aplicación (PWA)
              </h3>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Acceso directo sin usar memoria del teléfono
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar instalación PWA"
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5 text-xs text-zinc-700 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200">
          <div className="font-bold text-zinc-900">
            ¿Cómo funciona en tu celular?
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-emerald-700">1. Android (Chrome):</span>
            <span>
              Pulsa el botón de abajo o el menú <b>⋮ → &quot;Instalar aplicación&quot;</b>.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-zinc-900">2. iPhone (Safari):</span>
            <span>
              Toca el botón <b>Compartir (↑) → &quot;Agregar a pantalla de inicio&quot;</b>.
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
              }
              onInstallPrompted();
              onClose();
            }}
            className="w-full min-h-[44px] py-3.5 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold shadow-md transition-all"
          >
            {pwaInstalled
              ? "✓ Aplicación ya instalada en tu inicio"
              : "📲 Instalar App Ahora (1-Toque)"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[40px] py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

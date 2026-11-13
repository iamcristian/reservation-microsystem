"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export interface ToastItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`pointer-events-auto rounded-2xl p-3.5 shadow-xl border backdrop-blur-md flex items-start gap-3 transition-all animate-in slide-in-from-top-3 fade-in duration-200 ${
            toast.type === "success"
              ? "bg-white/95 border-emerald-300 text-zinc-900 shadow-emerald-500/10"
              : toast.type === "error"
              ? "bg-white/95 border-red-300 text-zinc-900 shadow-red-500/10"
              : toast.type === "warning"
              ? "bg-white/95 border-amber-300 text-zinc-900 shadow-amber-500/10"
              : "bg-white/95 border-blue-300 text-zinc-900 shadow-blue-500/10"
          }`}
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              toast.type === "success"
                ? "bg-emerald-100 text-emerald-600"
                : toast.type === "error"
                ? "bg-red-100 text-red-600"
                : toast.type === "warning"
                ? "bg-amber-100 text-amber-600"
                : "bg-blue-100 text-blue-600"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="w-4 h-4" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
            {toast.type === "warning" && <AlertTriangle className="w-4 h-4" />}
            {toast.type === "info" && <Info className="w-4 h-4" />}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="font-bold text-xs text-zinc-900 leading-snug">
              {toast.title}
            </h4>
            {toast.message && (
              <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                {toast.message}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded-lg transition-colors shrink-0"
            title="Cerrar notificación"
            aria-label="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

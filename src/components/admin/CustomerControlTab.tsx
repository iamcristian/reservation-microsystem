"use client";

import React from "react";
import { Phone } from "lucide-react";
import { WhatsAppIcon } from "../WhatsAppIcon";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export interface AdminCustomerItem {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isBlocked: boolean;
  noShowCount?: number | null;
  completedCount?: number | null;
}

interface CustomerControlTabProps {
  allUsers: AdminCustomerItem[];
  custFilter: "all" | "issues";
  onChangeFilter: (filter: "all" | "issues") => void;
  onResetUserStrikes: (userId: string) => void;
  onToggleBlockUser: (userId: string, currentlyBlocked: boolean) => void;
}

export function CustomerControlTab({
  allUsers,
  custFilter,
  onChangeFilter,
  onResetUserStrikes,
  onToggleBlockUser,
}: CustomerControlTabProps) {
  const issueUsersCount = allUsers.filter(
    (u) => (u.noShowCount || 0) > 0 || u.isBlocked
  ).length;

  const visibleUsers = allUsers.filter((u) =>
    custFilter === "issues" ? (u.noShowCount || 0) > 0 || u.isBlocked : true
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">
            Control de Clientes y Faltas
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
            Al acumular 2 inasistencias se bloquean automáticamente. Al reiniciar faltas, las anteriores pasan al archivo histórico.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-full self-start sm:self-auto whitespace-nowrap shrink-0">
          {allUsers.length} registrados
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onChangeFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            custFilter === "all"
              ? "bg-[#1F1F23] text-white shadow-sm"
              : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
          }`}
        >
          Todos ({allUsers.length})
        </button>
        <button
          type="button"
          onClick={() => onChangeFilter("issues")}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
            custFilter === "issues"
              ? "bg-[#1F1F23] text-white shadow-sm"
              : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
          }`}
        >
          <span>⚠️ Con faltas / Bloqueados</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-zinc-950 font-extrabold">
            {issueUsersCount}
          </span>
        </button>
      </div>

      <div className="space-y-2.5">
        {visibleUsers.map((u) => (
          <div
            key={u.id}
            className={`p-3.5 rounded-3xl border transition-all ${
              u.isBlocked
                ? "bg-red-50 border-red-200"
                : "bg-white border-zinc-200 shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-sm text-zinc-900 flex items-center gap-1.5 flex-wrap">
                  <span>{u.name}</span>
                  {u.isBlocked && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                      BLOQUEADO
                    </span>
                  )}
                  {(u.noShowCount || 0) >= 2 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-zinc-950">
                      2+ Inasistencias
                    </span>
                  )}
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 break-words">
                  {u.email} {u.phone ? `• ${u.phone}` : "• Sin teléfono"}
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="text-[11px] text-zinc-600 whitespace-nowrap">
                  Asistidas: <b className="text-emerald-700">{u.completedCount || 0}</b> | Faltas vigentes:{" "}
                  <b className={(u.noShowCount || 0) > 0 ? "text-amber-700" : "text-zinc-600"}>
                    {u.noShowCount || 0}/2
                  </b>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2">
                {u.phone && (
                  <>
                    <a
                      href={`tel:${u.phone}`}
                      className="px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-medium flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Llamar</span>
                    </a>
                    <a
                      href={buildWhatsAppUrl(u.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(u.noShowCount || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => onResetUserStrikes(u.id)}
                    className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                    title="Archivar faltas anteriores en su historial y devolver contador a 0/2"
                  >
                    {u.isBlocked
                      ? "🔄 Reiniciar faltas y Desbloquear"
                      : "🔄 Justificar / Archivar faltas"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onToggleBlockUser(u.id, u.isBlocked)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    u.isBlocked
                      ? "bg-zinc-800 text-white hover:bg-black"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                >
                  {u.isBlocked ? "Desbloquear" : "Bloquear Cuenta"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

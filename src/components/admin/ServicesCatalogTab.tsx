"use client";

import React from "react";
import { Plus } from "lucide-react";

export interface CatalogStaffMember {
  id: string;
  displayName: string;
  services?: Array<{ serviceId: string }>;
}

export interface CatalogServiceItem {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  bufferAfterMin?: number | null;
  price: number;
  isActive?: boolean;
  staff?: Array<{ staffId: string }>;
}

interface ServicesCatalogTabProps {
  services: CatalogServiceItem[];
  staffList: CatalogStaffMember[];
  currencySymbol: string;
  onOpenNewService: () => void;
  onOpenEditService: (svc: CatalogServiceItem, currentStaffIds: string[]) => void;
  onToggleServiceStaff: (svc: CatalogServiceItem, st: CatalogStaffMember) => void;
}

export function ServicesCatalogTab({
  services,
  staffList,
  currencySymbol,
  onOpenNewService,
  onOpenEditService,
  onToggleServiceStaff,
}: ServicesCatalogTabProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">
          Catálogo de Servicios ({services.length})
        </h2>
        <button
          type="button"
          onClick={onOpenNewService}
          className="px-3.5 min-h-[36px] rounded-full bg-[#1F1F23] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Servicio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((svc) => {
          const assignedStaff = staffList.filter(
            (st) =>
              svc.staff?.some((s) => s.staffId === st.id) ||
              st.services?.some((s) => s.serviceId === svc.id)
          );

          return (
            <div
              key={svc.id}
              className="p-4 rounded-3xl border border-zinc-200 bg-white flex flex-col justify-between text-xs shadow-sm hover:border-zinc-300 transition-all gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-zinc-900">{svc.name}</div>
                  {svc.description && (
                    <div className="text-zinc-500 text-[11px] mt-0.5 line-clamp-1">
                      {svc.description}
                    </div>
                  )}
                  <div className="text-zinc-500 text-[11px] mt-0.5 font-medium">
                    ⏱️ {svc.durationMin} min{" "}
                    {(svc.bufferAfterMin ?? 0) > 0 &&
                      `(+${svc.bufferAfterMin} min limpieza)`}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="font-bold text-sm text-zinc-900">
                    {currencySymbol}
                    {svc.price.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenEditService(
                        svc,
                        assignedStaff.map((s) => s.id)
                      )
                    }
                    className="px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-all"
                  >
                    ✏️ Editar
                  </button>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="pt-2.5 border-t border-zinc-100 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">
                    ¿Quiénes lo realizan? ({assignedStaff.length}/{staffList.length})
                  </span>
                  {assignedStaff.length === 0 ? (
                    <span className="text-amber-800 font-bold bg-amber-100 border border-amber-300 px-2 py-0.2 rounded-full">
                      ⚠️ Sin asignar
                    </span>
                  ) : assignedStaff.length === staffList.length ? (
                    <span className="text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full">
                      ✓ Todo el equipo
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {staffList.map((st) => {
                    const isAssigned = assignedStaff.some((a) => a.id === st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onToggleServiceStaff(svc, st)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 ${
                          isAssigned
                            ? "bg-[#1F1F23] text-white shadow-2xs hover:bg-black"
                            : "bg-zinc-100 border border-dashed border-zinc-300 text-zinc-400 hover:text-zinc-700 hover:border-zinc-400"
                        }`}
                        title={
                          isAssigned
                            ? `Clic para quitar a ${st.displayName} de "${svc.name}"`
                            : `Clic para asignar a ${st.displayName} en "${svc.name}"`
                        }
                      >
                        <span>{isAssigned ? "✓" : "○"}</span>
                        <span>{st.displayName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

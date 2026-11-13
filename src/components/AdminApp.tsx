"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Phone,
  Shield,
  Settings,
  Plus,
  Check,
  AlertTriangle,
  AlertCircle,
  Stethoscope,
  ChevronRight,
  Sun,
  Sunset,
  Coffee,
  Sparkles,
  Save,
  Trash2,
  MapPin,
  Pencil,
  FileText,
} from "lucide-react";
import BranchMap from "./BranchMap";
import InteractiveMapPicker from "./InteractiveMapPicker";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { ToastContainer, ToastItem } from "./ui/ToastContainer";
import { ConfirmModal, ConfirmModalState } from "./ui/ConfirmModal";
import { ServicesCatalogTab } from "./admin/ServicesCatalogTab";
import { CustomerControlTab } from "./admin/CustomerControlTab";
import { compressImageFileToDataUrl } from "@/lib/image-utils";
import {
  buildCustomerCancellationWhatsAppUrl,
  buildCustomerNoShowWhatsAppUrl,
  buildStaffInviteWhatsAppUrl,
} from "@/lib/whatsapp";
import { formatLocalDateYYYYMMDD } from "@/lib/date-utils";
import {
  validateAllShifts,
  timeToMinutes,
  minutesToTime,
  ShiftItem,
  getDayScheduleStatus,
  getSuggestedOverrideTime,
  validateScheduleOverride,
  validateVacationRange,
} from "@/lib/validation/acceptance-criteria";

interface AdminAppProps {
  initialData: any;
  onRefresh: () => void;
}

export function AdminApp({ initialData, onRefresh }: AdminAppProps) {
  const settings = initialData?.settings;
  const services = initialData?.services || [];
  const staffList = initialData?.staff || [];
  const currentUser = initialData?.currentUser;
  const allUsers = initialData?.allUsers || [];

  const [activeTab, setActiveTab] = useState<
    "agenda" | "shifts" | "team" | "services" | "customers" | "settings"
  >("agenda");

  // Role-based access control: ADMIN (Owner) vs PROVIDER (Staff/Doctor)
  const isProviderOnly = currentUser?.role === "PROVIDER";
  const isOwnerAdmin = !isProviderOnly;

  const resolveOverrideTargets = (targetId: string) => {
    if (targetId === "ALL") {
      return staffList.filter((s: any) => s.isActive !== false);
    }
    const found = staffList.find((s: any) => s.id === targetId);
    return found ? [found] : [];
  };

  // Selected date and staff for Agenda tab
  const [agendaDateStr, setAgendaDateStr] = useState<string>(
    formatLocalDateYYYYMMDD(new Date())
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    staffList[0]?.id || ""
  );

  // New Staff Member modal state (for Equipo / Personal tab)
  const [staffModal, setStaffModal] = useState<{
    displayName: string;
    specialty: string;
    email: string;
    phone: string;
    bio: string;
    avatarUrl: string;
    serviceIds?: string[];
  } | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  // Toast notifications state (modern replacement for window.alert)
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (
    type: ToastItem["type"],
    title: string,
    message?: string
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Modern confirm modal state (replacement for window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmModalState | null>(null);

  const selectedStaff =
    staffList.find((s: any) => s.id === selectedStaffId) || staffList[0];

  // Shifts editing state
  const [isEditingShifts, setIsEditingShifts] = useState(false);
  const [editingShiftsList, setEditingShiftsList] = useState<
    { tempId: string; dayOfWeek: number; startTime: string; endTime: string }[]
  >([]);
  const [editingHorizonDays, setEditingHorizonDays] = useState<number>(7);
  const [editingLeadTimeMin, setEditingLeadTimeMin] = useState<number>(30);
  const [savingShifts, setSavingShifts] = useState(false);
  const [highlightedShiftDay, setHighlightedShiftDay] = useState<number | null>(null);

  // Strict real-time validation against Acceptance Criteria
  const shiftsValidation = useMemo(() => {
    return validateAllShifts(editingShiftsList, { maxShiftsPerDay: 3, minDurationMin: 30 });
  }, [editingShiftsList]);

  const openShiftsEditor = (targetStaffObj?: any, focusDayOfWeek?: number) => {
    const staffToEdit = targetStaffObj || selectedStaff;
    if (!staffToEdit) return;

    if (staffToEdit.id && staffToEdit.id !== selectedStaffId) {
      setSelectedStaffId(staffToEdit.id);
    }

    const currentShifts = staffToEdit.workingShifts || [];
    setEditingShiftsList(
      currentShifts.map((s: any) => ({
        tempId: s.id || "shift-" + Math.random().toString(36).substring(2, 9),
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      }))
    );
    setEditingHorizonDays(
      staffToEdit.customHorizonDays ?? settings?.bookingHorizonDays ?? 7
    );
    setEditingLeadTimeMin(
      staffToEdit.customLeadTimeMin ?? settings?.minLeadTimeMinutes ?? 30
    );
    setIsEditingShifts(true);
    setActiveTab("shifts");

    if (typeof focusDayOfWeek === "number") {
      setHighlightedShiftDay(focusDayOfWeek);
      setTimeout(() => {
        document
          .getElementById(`shift-day-${focusDayOfWeek}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      setTimeout(() => {
        setHighlightedShiftDay((prev) => (prev === focusDayOfWeek ? null : prev));
      }, 2600);
    }
  };

  const startEditingShifts = () => {
    openShiftsEditor(selectedStaff);
  };

  const handleToggleDay = (day: number) => {
    const hasAny = editingShiftsList.some((s) => s.dayOfWeek === day);
    if (hasAny) {
      setEditingShiftsList(editingShiftsList.filter((s) => s.dayOfWeek !== day));
    } else {
      setEditingShiftsList([
        ...editingShiftsList,
        {
          tempId: "shift-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "18:00",
        },
      ]);
    }
  };

  const handleAddShiftToDay = (day: number) => {
    const existing = editingShiftsList.filter((s) => s.dayOfWeek === day);
    if (existing.length >= 3) {
      showToast("warning", "Límite de turnos alcanzado", "Criterio de Aceptación: Máximo 3 turnos permitidos por día.");
      return;
    }

    // Intelligent default to prevent automated collisions
    let newStart = "15:00";
    let newEnd = "19:00";

    if (existing.length > 0) {
      const sorted = [...existing].sort(
        (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      );
      const lastShift = sorted[sorted.length - 1];
      const lastEndMin = timeToMinutes(lastShift.endTime);

      if (lastEndMin > 0 && lastEndMin < 1260) {
        // At least 1 hour break after the last shift
        const proposedStartMin = lastEndMin + 60;
        const proposedEndMin = Math.min(1380, proposedStartMin + 240); // 4 horas
        if (proposedEndMin - proposedStartMin >= 30) {
          newStart = minutesToTime(proposedStartMin);
          newEnd = minutesToTime(proposedEndMin);
        }
      }
    }

    setEditingShiftsList([
      ...editingShiftsList,
      {
        tempId: "shift-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        dayOfWeek: day,
        startTime: newStart,
        endTime: newEnd,
      },
    ]);
  };

  const handleUpdateShiftTime = (
    tempId: string,
    field: "startTime" | "endTime",
    val: string
  ) => {
    setEditingShiftsList((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, [field]: val } : s))
    );
  };

  const handleRemoveSpecificShift = (tempId: string) => {
    setEditingShiftsList((prev) => prev.filter((s) => s.tempId !== tempId));
  };

  const handleCopyMondayToWeek = () => {
    const mondayShifts = editingShiftsList.filter((s) => s.dayOfWeek === 1);
    if (mondayShifts.length === 0) {
      showToast(
        "info",
        "Lunes sin turnos",
        "El lunes no tiene turnos configurados. Agrega un horario al lunes antes de copiar."
      );
      return;
    }
    const remaining = editingShiftsList.filter(
      (s) => s.dayOfWeek !== 2 && s.dayOfWeek !== 3 && s.dayOfWeek !== 4 && s.dayOfWeek !== 5
    );
    const newShifts: { tempId: string; dayOfWeek: number; startTime: string; endTime: string }[] = [];
    [2, 3, 4, 5].forEach((d) => {
      mondayShifts.forEach((m) => {
        newShifts.push({
          tempId: "shift-" + d + "-" + Math.random().toString(36).substring(2, 7),
          dayOfWeek: d,
          startTime: m.startTime,
          endTime: m.endTime,
        });
      });
    });
    setEditingShiftsList([...remaining, ...newShifts]);
    showToast(
      "success",
      "Horarios copiados",
      "Se duplicaron los turnos del lunes para Martes, Miércoles, Jueves y Viernes."
    );
  };

  const handleApplyPreset = (type: "continua" | "partido") => {
    const newShifts: { tempId: string; dayOfWeek: number; startTime: string; endTime: string }[] = [];
    // Mon-Fri
    [1, 2, 3, 4, 5].forEach((d) => {
      if (type === "continua") {
        newShifts.push({
          tempId: "shift-" + d + "-c",
          dayOfWeek: d,
          startTime: "09:00",
          endTime: "18:00",
        });
      } else {
        newShifts.push({
          tempId: "shift-" + d + "-p1",
          dayOfWeek: d,
          startTime: "09:00",
          endTime: "13:00",
        });
        newShifts.push({
          tempId: "shift-" + d + "-p2",
          dayOfWeek: d,
          startTime: "15:00",
          endTime: "19:00",
        });
      }
    });
    // Saturday half-day
    newShifts.push({
      tempId: "shift-6-sat",
      dayOfWeek: 6,
      startTime: "09:00",
      endTime: "13:00",
    });
    setEditingShiftsList(newShifts);
    showToast(
      "success",
      "Plantilla aplicada",
      type === "continua"
        ? "Jornada continua (09:00 - 18:00) cargada para Lun-Vie."
        : "Turno partido (09:00-13:00 y 15:00-19:00) cargado para Lun-Vie."
    );
  };

  const handleSaveShifts = async () => {
    if (!selectedStaff?.id) return;

    if (!shiftsValidation.isValid) {
      showToast(
        "error",
        "Criterios de Aceptación",
        "No se pueden guardar los horarios porque contienen errores señalados en rojo."
      );
      return;
    }

    setSavingShifts(true);
    try {
      const res = await fetch("/api/admin/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: selectedStaff.id,
          shifts: editingShiftsList.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
          customHorizonDays: editingHorizonDays,
          customLeadTimeMin: editingLeadTimeMin,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Error en respuesta del servidor." }));
      if (!res.ok) {
        showToast("error", "Error al guardar horarios", data.error || "No se pudieron guardar los horarios.");
        return;
      }
      setIsEditingShifts(false);
      showToast(
        "success",
        "¡Horarios Guardados!",
        `La agenda semanal de ${selectedStaff.displayName} se actualizó exitosamente.`
      );
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error al guardar horarios", e.message);
    } finally {
      setSavingShifts(false);
    }
  };

  // Toggle Doctor Active / Vacation mode
  const handleToggleStaffActive = async (staffId: string, newActiveState: boolean) => {
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, isActive: newActiveState }),
      });
      const data = await res.json().catch(() => ({ error: "Error en respuesta del servidor." }));
      if (!res.ok) {
        showToast("error", "Error", data.error || "No se pudo actualizar el estado.");
        return;
      }
      showToast(
        "success",
        newActiveState ? "¡Agenda Reanudada!" : "🏖️ ¡Modo Vacaciones Activado!",
        newActiveState
          ? "El profesional vuelve a estar visible en el portal para recibir reservas."
          : "El profesional ha sido pausado y ocultado del portal de reservas."
      );
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error", e.message);
    }
  };

  // Helper: get currently assigned serviceIds for a staff member
  const getAssignedServiceIdsForStaff = (staffObj: any): string[] => {
    if (!staffObj) return [];
    return services
      .filter(
        (svc: any) =>
          staffObj.services?.some((rel: any) => rel.serviceId === svc.id) ||
          svc.staff?.some((rel: any) => rel.staffId === staffObj.id)
      )
      .map((svc: any) => svc.id);
  };

  // Toggle a single service assignment for a staff member (1-click pill toggle)
  const handleToggleStaffService = async (staffObj: any, serviceObj: any) => {
    if (!staffObj?.id || !serviceObj?.id) return;
    const currentIds = getAssignedServiceIdsForStaff(staffObj);
    const isCurrentlyAssigned = currentIds.includes(serviceObj.id);
    const nextIds = isCurrentlyAssigned
      ? currentIds.filter((id) => id !== serviceObj.id)
      : [...currentIds, serviceObj.id];

    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: staffObj.id,
          serviceIds: nextIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Error", data.error || "No se pudo actualizar los servicios.");
        return;
      }
      showToast(
        isCurrentlyAssigned ? "info" : "success",
        isCurrentlyAssigned ? "Servicio bloqueado para este profesional" : "Servicio habilitado",
        isCurrentlyAssigned
          ? `${staffObj.displayName} ya no recibirá citas de "${serviceObj.name}".`
          : `${staffObj.displayName} ahora atiende "${serviceObj.name}".`
      );
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error", e.message);
    }
  };

  // Set all services for a staff member at once
  const handleSetAllStaffServices = async (staffObj: any, nextIds: string[]) => {
    if (!staffObj?.id) return;
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: staffObj.id,
          serviceIds: nextIds,
        }),
      });
      if (res.ok) {
        showToast(
          "success",
          "Servicios actualizados",
          `Se actualizaron los servicios asignados a ${staffObj.displayName}.`
        );
        onRefresh();
      }
    } catch (e: any) {
      showToast("error", "Error", e.message);
    }
  };

  // Toggle a single staff member on a service card (1-click pill toggle)
  const handleToggleServiceStaff = async (serviceObj: any, staffObj: any) => {
    if (!serviceObj?.id || !staffObj?.id) return;
    const currentStaffIds = staffList
      .filter(
        (st: any) =>
          serviceObj.staff?.some((rel: any) => rel.staffId === st.id) ||
          st.services?.some((rel: any) => rel.serviceId === serviceObj.id)
      )
      .map((st: any) => st.id);

    const isAssigned = currentStaffIds.includes(staffObj.id);
    const nextStaffIds = isAssigned
      ? currentStaffIds.filter((id: string) => id !== staffObj.id)
      : [...currentStaffIds, staffObj.id];

    try {
      const res = await fetch("/api/admin/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: serviceObj.id,
          staffIds: nextStaffIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "Error", data.error || "No se pudo actualizar la asignación.");
        return;
      }
      showToast(
        isAssigned ? "info" : "success",
        isAssigned ? "Profesional desasignado" : "Profesional asignado",
        isAssigned
          ? `${staffObj.displayName} ya no realiza "${serviceObj.name}".`
          : `${staffObj.displayName} ha sido habilitado para "${serviceObj.name}".`
      );
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error", e.message);
    }
  };

  // Lock PROVIDER role to their own staff profile and allowed tabs, and sync when user changes
  const lastSyncedUserIdRef = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    const ownProfile =
      staffList.find(
        (s: any) =>
          s.userId === currentUser?.id ||
          (s.user?.email && s.user.email === currentUser?.email) ||
          s.displayName?.toLowerCase() === currentUser?.name?.toLowerCase()
      ) || staffList[0];

    const userChanged =
      currentUser?.id && lastSyncedUserIdRef.current !== currentUser.id;
    if (currentUser?.id) {
      lastSyncedUserIdRef.current = currentUser.id;
    }

    if (isProviderOnly) {
      const providerProfile = ownProfile || staffList[1] || staffList[0];
      if (providerProfile && selectedStaffId !== providerProfile.id) {
        setSelectedStaffId(providerProfile.id);
      }
      if (activeTab !== "agenda" && activeTab !== "shifts") {
        setActiveTab("agenda");
      }
    } else if (userChanged && ownProfile?.id) {
      setSelectedStaffId(ownProfile.id);
    } else if (!selectedStaffId && staffList[0]?.id) {
      setSelectedStaffId(staffList[0].id);
    }
  }, [isProviderOnly, currentUser?.id, currentUser?.email, currentUser?.name, staffList, activeTab, selectedStaffId]);

  // Appointments state
  const [loadingApts, setLoadingApts] = useState(false);
  const [adminAptFilter, setAdminAptFilter] = useState<
    "pending" | "completed" | "noshow" | "all"
  >("pending");
  const [noShowModalData, setNoShowModalData] = useState<any | null>(null);

  // Imprevistos modal state
  const [imprevistoModal, setImprevistoModal] = useState<{
    open: boolean;
    type: "LATE_START" | "EARLY_LEAVE" | "FULL_DAY_OFF";
    timeStr: string;
    reason: string;
    staffId?: string;
  }>({
    open: false,
    type: "LATE_START",
    timeStr: "09:30",
    reason: "",
    staffId: "",
  });

  // Conflict state when doctor blocks time
  const [conflictData, setConflictData] = useState<{
    open: boolean;
    conflicts: any[];
    blockStart: string;
    blockEnd: string;
    type: string;
    reason: string;
  } | null>(null);

  // Vacation date range modal state
  const [vacationModal, setVacationModal] = useState<{
    open: boolean;
    staffId: string;
    startDate: string;
    endDate: string;
    reason: string;
  }>({
    open: false,
    staffId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  // White-label settings state
  const [settingsForm, setSettingsForm] = useState<any>({ ...settings });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (settings) {
      setSettingsForm({ ...settings });
    }
  }, [settings]);

  // New Service modal state
  const [serviceModal, setServiceModal] = useState<any | null>(null);

  const [allAppointments, setAllAppointments] = useState<any[]>(
    initialData?.allAppointments || []
  );

  // Keep allAppointments synchronized with initialData from parent
  useEffect(() => {
    if (initialData?.allAppointments) {
      setAllAppointments(initialData.allAppointments);
    }
  }, [initialData?.allAppointments]);

  // Derive dayAppointments reactively and deterministically from allAppointments
  const dayAppointments = useMemo(() => {
    return allAppointments.filter((a: any) => {
      const aStr = formatLocalDateYYYYMMDD(new Date(a.startAt));
      const matchesStaff =
        !selectedStaffId ||
        selectedStaffId === "ALL" ||
        a.staffId === selectedStaffId;
      return aStr === agendaDateStr && matchesStaff;
    });
  }, [allAppointments, agendaDateStr, selectedStaffId]);

  // Fetch appointments for agenda date and selected staff
  const loadDayAppointments = () => {
    setLoadingApts(true);
    fetch("/api/bootstrap", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((data) => {
        if (!data) return;
        const apts = data.allAppointments || data.userAppointments || [];
        setAllAppointments(apts);
      })
      .catch((err) => console.error("Error loading appointments:", err))
      .finally(() => setLoadingApts(false));
  };

  // Handle Quick Imprevisto submit
  const handleQuickImprevisto = async (resolution?: string, overrideStaffId?: string) => {
    let startAt = new Date(`${agendaDateStr}T00:00:00`);
    let endAt = new Date(`${agendaDateStr}T09:30:00`);

    if (imprevistoModal.type === "LATE_START") {
      startAt = new Date(`${agendaDateStr}T00:00:00`);
      endAt = new Date(`${agendaDateStr}T${imprevistoModal.timeStr}:00`);
    } else if (imprevistoModal.type === "EARLY_LEAVE") {
      startAt = new Date(`${agendaDateStr}T${imprevistoModal.timeStr}:00`);
      endAt = new Date(`${agendaDateStr}T23:59:59`);
    } else if (imprevistoModal.type === "FULL_DAY_OFF") {
      startAt = new Date(`${agendaDateStr}T00:00:00`);
      endAt = new Date(`${agendaDateStr}T23:59:59`);
    }

    const targetStaffId =
      overrideStaffId || imprevistoModal.staffId || selectedStaffId;

    try {
      const res = await fetch("/api/admin/day-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: targetStaffId,
          type: imprevistoModal.type,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          reason: imprevistoModal.reason || "Imprevisto de agenda",
          resolution,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast("error", "No se pudo aplicar el bloqueo", data.error || "Error en el servidor.");
        return;
      }

      if (data.hasConflicts && !resolution) {
        // Open conflict resolution modal
        setConflictData({
          open: true,
          conflicts: data.affectedAppointments || [],
          blockStart: startAt.toISOString(),
          blockEnd: endAt.toISOString(),
          type: imprevistoModal.type,
          reason: imprevistoModal.reason,
        });
        return;
      }

      if (targetStaffId && targetStaffId !== selectedStaffId) {
        setSelectedStaffId(targetStaffId);
      }
      setImprevistoModal({ ...imprevistoModal, open: false });
      setConflictData(null);
      showToast(
        "success",
        "¡Imprevisto Guardado!",
        data.conflictsResolved > 0
          ? `Se cerró el horario y se notificó la cancelación de ${data.conflictsResolved} cita(s) al cliente.`
          : "El bloqueo de horario se aplicó correctamente."
      );
      loadDayAppointments();
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error al guardar imprevisto", e.message);
    }
  };

  const handleDeleteTimeOff = async (timeOffId: string) => {
    try {
      const res = await fetch(`/api/admin/day-override?id=${encodeURIComponent(timeOffId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", "No se pudo quitar el bloqueo", data.error || "Error al eliminar bloqueo.");
        return;
      }
      showToast("success", "Horario Reabierto", "El bloqueo de agenda fue eliminado y los turnos vuelven a estar disponibles.");
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error", e.message);
    }
  };

  // Handle Schedule Vacation Range
  const handleScheduleVacation = async (resolution?: string) => {
    if (!vacationModal.startDate || !vacationModal.endDate) {
      showToast(
        "warning",
        "Fechas incompletas",
        "Por favor selecciona la fecha de inicio y de fin de las vacaciones."
      );
      return;
    }
    if (vacationModal.startDate > vacationModal.endDate) {
      showToast(
        "warning",
        "Rango inválido",
        "La fecha de inicio debe ser anterior o igual a la fecha de fin."
      );
      return;
    }

    const startAt = new Date(`${vacationModal.startDate}T00:00:00`);
    const endAt = new Date(`${vacationModal.endDate}T23:59:59`);
    const targetStaffId = vacationModal.staffId || selectedStaffId;

    try {
      const res = await fetch("/api/admin/day-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: targetStaffId,
          type: "VACATION",
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          reason: vacationModal.reason.trim() || null,
          resolution: resolution || (conflictData ? "CANCEL_ALL" : undefined),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast("error", "No se pudo guardar", data.error || "Error al programar vacaciones.");
        return;
      }

      if (data.hasConflicts && !resolution) {
        setConflictData({
          open: true,
          conflicts: data.affectedAppointments || [],
          blockStart: startAt.toISOString(),
          blockEnd: endAt.toISOString(),
          type: "VACATION",
          reason: vacationModal.reason,
        });
        return;
      }

      setVacationModal((prev) => ({ ...prev, open: false }));
      setConflictData(null);
      showToast(
        "success",
        "🏖️ ¡Vacaciones Programadas!",
        `El periodo del ${vacationModal.startDate} al ${vacationModal.endDate} ha quedado reservado y bloqueado para citas.`
      );
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error al programar vacaciones", e.message);
    }
  };

  // Generate WhatsApp URL with automated cancellation notice
  const getWhatsAppCancelUrl = (apt: any) =>
    buildCustomerCancellationWhatsAppUrl(apt, settings?.name);

  // Generate WhatsApp URL with automated absence notice (No-Show)
  const getWhatsAppNoShowUrl = (apt: any) =>
    buildCustomerNoShowWhatsAppUrl(apt, settings?.name);

  // Handle Appointment Status Change (Doctors/Admins can always cancel any appointment regardless of customer 6h notice rule)
  const handleStatusChange = async (
    aptId: string,
    status: string,
    blockCustomer?: boolean,
    customReason?: string
  ) => {
    try {
      const reason =
        customReason ||
        (status === "CANCELLED"
          ? "Cancelada por el profesional / imprevisto de agenda"
          : undefined);
      const res = await fetch(`/api/admin/appointments/${aptId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, blockCustomer, reason }),
      });
      if (res.ok) {
        if (status === "CANCELLED") {
          showToast(
            "info",
            "Cita cancelada",
            "Se canceló la cita y se envió el aviso automático al portal del cliente."
          );
        }
        loadDayAppointments();
        onRefresh();
      }
    } catch (e: any) {
      showToast("error", "Error al actualizar estado", e.message);
    }
  };

  // Cancel all pending appointments for the current date & selected staff (or all staff)
  const handleCancelAllDayAppointments = async (targetApts: any[]) => {
    if (!targetApts || targetApts.length === 0) return;
    try {
      for (const apt of targetApts) {
        await fetch(`/api/admin/appointments/${apt.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "CANCELLED",
            reason: `No atiendo el ${agendaDateStr} por descanso/imprevisto`,
          }),
        });
      }
      showToast(
        "success",
        `¡${targetApts.length} cita(s) cancelada(s)!`,
        "Todas las citas seleccionadas fueron canceladas y los clientes recibieron el aviso para reagendar."
      );
      loadDayAppointments();
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error al cancelar citas", e.message);
    }
  };

  const [custFilter, setCustFilter] = useState<"all" | "issues">("all");

  // Handle Toggle Block User
  const handleToggleBlockUser = async (userId: string, isBlocked: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-block`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBlocked: !isBlocked,
          resetNoShows: isBlocked ? true : false,
        }),
      });
      if (res.ok) {
        showToast(
          isBlocked ? "success" : "warning",
          isBlocked ? "Cliente Desbloqueado" : "Cliente Bloqueado",
          isBlocked
            ? "El cliente puede volver a realizar reservas en línea."
            : "Se bloqueó el acceso de reserva en línea para este cliente."
        );
        onRefresh();
      }
    } catch (e: any) {
      showToast("error", "Error al cambiar bloqueo", e.message);
    }
  };

  // Handle Reset / Archive User No-Shows and Unblock
  const handleResetUserStrikes = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-block`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: false, resetNoShows: true }),
      });
      if (res.ok) {
        showToast("success", "Historial Limpiado", "Se reiniciaron las inasistencias y se desbloqueó al cliente.");
        onRefresh();
      }
    } catch (e: any) {
      showToast("error", "Error al resetear inasistencias", e.message);
    }
  };

  // Handle Logo File Upload (converts image to lightweight DataURL)
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 256, 0.88);
      setSettingsForm((prev: any) => ({ ...prev, logoUrl: dataUrl }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "No se pudo procesar la imagen seleccionada.";
      showToast("warning", "Formato de imagen inválido", msg);
    }
  };

  // Handle Create / Authorize Staff Member (Doctor / Employee)
  const handleCreateStaff = async () => {
    if (!staffModal) return;
    const { displayName, specialty, email, phone, bio, avatarUrl } = staffModal;
    if (!displayName || displayName.trim().length < 3) {
      showToast("warning", "Nombre requerido", "Ingresa el nombre completo del profesional (mínimo 3 caracteres).");
      return;
    }
    if (!specialty || specialty.trim().length < 3) {
      showToast("warning", "Especialidad requerida", "Ingresa la especialidad o cargo del profesional.");
      return;
    }
    const emailClean = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      showToast("warning", "Correo inválido", "Ingresa un correo de Google válido (ej. doctor@clinica.com) para vincular su acceso.");
      return;
    }

    setSavingStaff(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          specialty: specialty.trim(),
          specialtyTitle: specialty.trim(),
          email: emailClean,
          phone: phone.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
          serviceIds: staffModal.serviceIds ?? services.map((s: any) => s.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", "Error al autorizar", data.error || "No se pudo registrar al profesional");
        return;
      }
      setStaffModal(null);
      showToast(
        "success",
        "¡Profesional Autorizado!",
        `Cuenta de ${displayName} habilitada con éxito para ${emailClean}. Ya puede iniciar sesión.`
      );
      onRefresh();
    } catch (e: any) {
      showToast("error", "Error", e.message);
    } finally {
      setSavingStaff(false);
    }
  };

  // Handle Revoke / Delete Staff Member
  const handleDeleteStaff = (staffId: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "¿Revocar acceso profesional?",
      message: `¿Estás seguro de revocar el acceso de ${name}? Su cuenta pasará a rol Cliente y ya no aparecerá en el selector de reservas de la clínica.`,
      confirmLabel: "Revocar Acceso",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/staff?staffId=${staffId}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (!res.ok) {
            showToast("error", "Error al revocar acceso", data.error || "No se pudo eliminar el profesional");
            return;
          }
          showToast("success", "Acceso Revocado", `Se revocó el perfil profesional de ${name}.`);
          onRefresh();
        } catch (e: any) {
          showToast("error", "Error", e.message);
        }
      },
    });
  };

  // Generate WhatsApp Invitation Link for New Staff Member
  const getWhatsAppStaffInviteUrl = (staff: any) => {
    const appUrl =
      typeof window !== "undefined" ? window.location.origin : "https://clinica.app";
    return buildStaffInviteWhatsAppUrl(
      staff,
      settings?.phoneWhatsapp,
      settings?.name,
      appUrl
    );
  };

  // Quick preview of a staff member's session
  const handlePreviewStaffSession = async (userId?: string) => {
    if (!userId) return;
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", "No se pudo cambiar de sesión", data.error || "Acción no autorizada.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Save Settings with strict validation
  const handleSaveSettings = async () => {
    if (!isOwnerAdmin) {
      showToast("warning", "Permiso denegado", "Solo el Administrador / Dueño principal puede modificar los datos del negocio.");
      return;
    }
    if (!settingsForm?.name || settingsForm.name.trim().length < 3) {
      showToast("warning", "Nombre inválido", "El nombre del negocio debe tener al menos 3 caracteres.");
      return;
    }
    if (!settingsForm?.addressText || settingsForm.addressText.trim().length < 5) {
      showToast("warning", "Dirección requerida", "Por favor ingresa una dirección física válida.");
      return;
    }
    const phoneDigits = (settingsForm?.phoneWhatsapp || "").replace(/\D/g, "");
    if (phoneDigits.length < 8) {
      showToast("warning", "Teléfono inválido", "El teléfono / WhatsApp del negocio debe tener al menos 8 dígitos.");
      return;
    }

    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (res.ok) {
        showToast("success", "¡Ajustes Guardados!", "La configuración del negocio, horarios globales y logo se guardaron con éxito.");
        onRefresh();
      } else {
        const err = await res.json();
        showToast("error", "Error al guardar ajustes", err.error || "No se pudieron actualizar los ajustes.");
      }
    } catch (e: any) {
      showToast("error", "Error de conexión", e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const visibleTabs = isOwnerAdmin
    ? [
        { id: "agenda", label: "Agenda & Imprevistos" },
        { id: "shifts", label: "Mis Horarios" },
        { id: "team", label: `👨‍⚕️ Equipo (${staffList.length})` },
        { id: "services", label: "Servicios" },
        { id: "customers", label: "Clientes" },
        { id: "settings", label: "Ajustes Local" },
      ]
    : [
        { id: "agenda", label: "📅 Mi Agenda & Imprevistos" },
        { id: "shifts", label: "⏰ Mis Horarios" },
      ];

  return (
    <div className="w-full max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto min-h-dvh bg-white text-[#1F1F23] pb-28 shadow-2xl relative border-x border-zinc-200 transition-all duration-300">
      {/* Top Header */}
      <header className="p-3.5 sm:p-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between md:sticky md:top-[44px] bg-white z-30 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full overflow-hidden border border-zinc-300 bg-zinc-100 flex-shrink-0 shadow-xs">
            <img
              src={
                settings?.logoUrl ||
                "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=200&auto=format&fit=crop&q=80"
              }
              alt={settings?.name || "Logo"}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                  isOwnerAdmin
                    ? "bg-[#1F1F23] text-white"
                    : "bg-emerald-700 text-white"
                }`}
              >
                {isOwnerAdmin
                  ? "👑 ADMIN / DUEÑO PRINCIPAL"
                  : "🩺 MODO EMPLEADO / DOCTOR"}
              </span>
              <span className="text-xs font-semibold text-zinc-600 truncate">
                {currentUser?.name || "Dr. Alejandro"}
              </span>
            </div>
            <h1 className="font-bold text-base tracking-tight text-[#1F1F23] mt-0.5 truncate">
              {settings?.name || "Clínica & Reservas"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Staff selector: Full selector for Owner/Admin, locked badge for Provider */}
          {isOwnerAdmin ? (
            <div className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-300 rounded-full px-3 py-1.5 w-full sm:w-auto">
              <span className="text-[10px] uppercase font-bold text-zinc-500 whitespace-nowrap">Agenda:</span>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                aria-label="Seleccionar profesional"
                className="text-base sm:text-xs font-bold bg-transparent text-[#1F1F23] focus:outline-none cursor-pointer flex-1 min-w-0"
              >
                <option value="ALL">👥 Todo el equipo</option>
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-full px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">
                {staffList.find((s: any) => s.id === selectedStaffId)
                  ?.displayName || currentUser?.name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Role Restriction Notice Banner when logged in as secondary Doctor / Employee */}
      {isProviderOnly && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs text-emerald-950">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div>
              <b>Cuenta de Profesional ({currentUser?.email}):</b> Puedes gestionar tu propia agenda, asistencias y bloquear imprevistos o ajustar tus horarios. Los datos de la empresa, logo y catálogo están protegidos y solo los administra el Dueño.
            </div>
          </div>
          {initialData?.impersonatorId && (
            <button
              onClick={() => handlePreviewStaffSession(initialData.impersonatorId)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#1F1F23] text-white text-[11px] font-bold hover:bg-black transition-all"
            >
              👑 Volver a Admin
            </button>
          )}
        </div>
      )}

      {/* Navigation Pills (High Contrast WCAG AAA) */}
      <div className="p-3 bg-zinc-50 border-b border-zinc-200 overflow-x-auto no-scrollbar pill-slider">
        <div className="bg-zinc-200 p-1 rounded-full flex gap-1 min-w-max border border-zinc-300">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-[#1F1F23] text-white shadow-sm"
                  : "text-[#1F1F23] hover:bg-zinc-300/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: AGENDA & QUICK IMPREVISTOS */}
      {activeTab === "agenda" && (
        <div className="p-4 space-y-4">
          {/* Quick Imprevistos Action Bar */}
          {(() => {
            const now = new Date();
            const agendaStatus = getDayScheduleStatus({
              dateStr: agendaDateStr,
              targets: resolveOverrideTargets(selectedStaffId),
              isAllTargets: selectedStaffId === "ALL",
              now,
            });
            const isClosedDay = agendaStatus.isDayClosedAlready;
            const closedTag =
              agendaStatus.closedBadge ||
              (agendaStatus.isPastDate
                ? "Fecha pasada"
                : !agendaStatus.hasShiftsOnDay
                ? "Sin atención"
                : `Cerró ${agendaStatus.latestEndStr}`);
            const isVacationBtnDisabled =
              agendaStatus.closureCode === "VACATION" ||
              agendaStatus.closureCode === "FULL_DAY_OFF" ||
              agendaStatus.closureCode === "STAFF_PAUSED" ||
              agendaStatus.closureCode === "PARTIAL_BLOCKS_CLOSED";
            const openDoctorsToday = isOwnerAdmin
              ? staffList.filter(
                  (st: any) =>
                    st.id !== selectedStaffId &&
                    !getDayScheduleStatus({
                      dateStr: agendaDateStr,
                      targets: [st],
                      now,
                    }).isDayClosedAlready
                )
              : [];

            return (
              <div className="p-3 bg-zinc-100 rounded-[24px] border border-zinc-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Acciones Rápidas de Imprevisto
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {isClosedDay ? closedTag : "1-Toque"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    disabled={isClosedDay}
                    title={isClosedDay ? agendaStatus.reason : undefined}
                    onClick={() =>
                      setImprevistoModal({
                        open: true,
                        type: "LATE_START",
                        timeStr: getSuggestedOverrideTime("LATE_START", agendaStatus, now),
                        reason: `Llegaré más tarde (${agendaDateStr})`,
                        staffId: selectedStaffId,
                      })
                    }
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isClosedDay
                        ? "bg-zinc-50 border-zinc-200 text-zinc-400 opacity-60 cursor-not-allowed"
                        : "bg-white border-zinc-300 text-zinc-800 hover:border-zinc-800 shadow-sm"
                    }`}
                  >
                    <Sun className={`w-4 h-4 mb-1 ${isClosedDay ? "text-zinc-400" : "text-amber-500"}`} />
                    <div className="text-xs font-bold leading-tight">Entro más tarde</div>
                    <div className="text-[10px] text-zinc-400">
                      {isClosedDay ? closedTag : "Hora de inicio"}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isClosedDay}
                    title={isClosedDay ? agendaStatus.reason : undefined}
                    onClick={() =>
                      setImprevistoModal({
                        open: true,
                        type: "EARLY_LEAVE",
                        timeStr: getSuggestedOverrideTime("EARLY_LEAVE", agendaStatus, now),
                        reason: `Cerrar temprano (${agendaDateStr})`,
                        staffId: selectedStaffId,
                      })
                    }
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isClosedDay
                        ? "bg-zinc-50 border-zinc-200 text-zinc-400 opacity-60 cursor-not-allowed"
                        : "bg-white border-zinc-300 text-zinc-800 hover:border-zinc-800 shadow-sm"
                    }`}
                  >
                    <Sunset className={`w-4 h-4 mb-1 ${isClosedDay ? "text-zinc-400" : "text-orange-500"}`} />
                    <div className="text-xs font-bold leading-tight">Salgo antes</div>
                    <div className="text-[10px] text-zinc-400">
                      {isClosedDay ? closedTag : "Hora de cierre"}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isClosedDay}
                    title={isClosedDay ? agendaStatus.reason : undefined}
                    onClick={() => {
                      const isToday = agendaDateStr === formatLocalDateYYYYMMDD(new Date());
                      setImprevistoModal({
                        open: true,
                        type: "FULL_DAY_OFF",
                        timeStr: "00:00",
                        reason: isToday ? "No atiendo hoy por descanso/imprevisto" : `Cerrado el ${agendaDateStr} por descanso/imprevisto`,
                        staffId: selectedStaffId,
                      });
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isClosedDay
                        ? "bg-zinc-50 border-zinc-200 text-zinc-400 opacity-60 cursor-not-allowed"
                        : "bg-white border-red-300 text-zinc-800 hover:border-zinc-800 shadow-sm"
                    }`}
                  >
                    <Coffee className={`w-4 h-4 mb-1 ${isClosedDay ? "text-zinc-400" : "text-purple-600"}`} />
                    <div className="text-xs font-bold leading-tight">Cerrar día</div>
                    <div className={`text-[10px] font-semibold ${isClosedDay ? "text-zinc-400" : "text-red-600"}`}>
                      {isClosedDay
                        ? closedTag
                        : agendaDateStr === formatLocalDateYYYYMMDD(new Date())
                        ? "No atender hoy"
                        : `Cerrar ${agendaDateStr}`}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isVacationBtnDisabled}
                    title={isVacationBtnDisabled ? agendaStatus.reason : undefined}
                    onClick={() =>
                      setVacationModal({
                        open: true,
                        staffId: selectedStaffId === "ALL" ? (staffList[0]?.id || "") : selectedStaffId,
                        startDate: agendaStatus.isPastDate
                          ? formatLocalDateYYYYMMDD(now)
                          : agendaDateStr,
                        endDate: "",
                        reason: "",
                      })
                    }
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isVacationBtnDisabled
                        ? "bg-zinc-50 border-zinc-200 text-zinc-400 opacity-60 cursor-not-allowed"
                        : "bg-white border-amber-300 text-zinc-800 hover:border-zinc-800 shadow-sm"
                    }`}
                  >
                    <div className={`text-sm leading-none mb-1 ${isVacationBtnDisabled ? "grayscale opacity-60" : ""}`}>🏖️</div>
                    <div className="text-xs font-bold leading-tight">Vacaciones</div>
                    <div className={`text-[10px] font-semibold ${isVacationBtnDisabled ? "text-zinc-400" : "text-amber-700"}`}>
                      {isVacationBtnDisabled ? closedTag : "Rango de fechas"}
                    </div>
                  </button>
                </div>

                {isClosedDay && (
                  <div className="p-2.5 rounded-2xl bg-white/80 border border-zinc-200 text-[11px] text-zinc-600 flex items-center justify-between gap-2 flex-wrap">
                    <span>🔒 {agendaStatus.reason}</span>
                    {openDoctorsToday.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {openDoctorsToday.map((st: any) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setSelectedStaffId(st.id)}
                            className="px-2.5 py-0.5 rounded-full bg-[#1F1F23] text-white text-[10px] font-bold hover:bg-black transition-all"
                          >
                            Ver {st.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Date Picker Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <input
                  type="date"
                  value={agendaDateStr}
                  onChange={(e) => setAgendaDateStr(e.target.value)}
                  className="font-bold text-base sm:text-sm bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-300 text-zinc-800 focus:outline-none"
                />

                {(() => {
                  const now = new Date();
                  const agendaDateObj = new Date(`${agendaDateStr}T00:00:00`);
                  const dayOfWeek = agendaDateObj.getDay();
                  const targets = resolveOverrideTargets(selectedStaffId);
                  const isAll = selectedStaffId === "ALL";
                  const dayStatus = getDayScheduleStatus({
                    dateStr: agendaDateStr,
                    targets,
                    isAllTargets: isAll,
                    now,
                  });

                  const focusedStaff = isAll
                    ? staffList.find((s: any) => s.id === currentUser?.staffProfile?.id) ||
                      targets.find((s: any) =>
                        (s.workingShifts || []).some((sh: any) => sh.dayOfWeek === dayOfWeek)
                      ) ||
                      staffList[0]
                    : targets[0] || selectedStaff;

                  const dayShifts = !isAll && focusedStaff
                    ? (focusedStaff.workingShifts || [])
                        .filter((s: any) => s.dayOfWeek === dayOfWeek)
                        .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
                    : [];

                  const baseScheduleText = isAll
                    ? dayStatus.hasShiftsOnDay
                      ? `${dayStatus.baseEarliestStartStr || dayStatus.earliestStartStr} - ${dayStatus.baseLatestEndStr || dayStatus.latestEndStr}`
                      : "Sin atención"
                    : dayShifts.length > 0
                    ? dayShifts.map((s: any) => `${s.startTime} - ${s.endTime}`).join(" · ")
                    : "Sin atención";

                  const scheduleText = dayStatus.hasPartialBlockOnDay
                    ? `${dayStatus.earliestStartStr} - ${dayStatus.latestEndStr}`
                    : baseScheduleText;

                  const hasHours = isAll ? dayStatus.hasShiftsOnDay : dayShifts.length > 0;
                  const isBlockedByVacationOrDayOff =
                    dayStatus.closureCode === "VACATION" ||
                    dayStatus.closureCode === "FULL_DAY_OFF" ||
                    dayStatus.closureCode === "PARTIAL_BLOCKS_CLOSED" ||
                    dayStatus.closureCode === "STAFF_PAUSED";
                  const showClosedTodayTag =
                    !isBlockedByVacationOrDayOff &&
                    dayStatus.isToday &&
                    dayStatus.hasShiftsOnDay &&
                    dayStatus.isDayClosedAlready;

                  return (
                    <div
                      data-testid="agenda-day-schedule"
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                        isBlockedByVacationOrDayOff
                          ? "bg-red-50 border-red-200 text-red-900"
                          : !hasHours
                          ? "bg-zinc-50 border-zinc-200 text-zinc-500"
                          : showClosedTodayTag || dayStatus.hasPartialBlockOnDay
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      }`}
                    >
                      <Clock
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isBlockedByVacationOrDayOff
                            ? "text-red-600"
                            : !hasHours
                            ? "text-zinc-400"
                            : showClosedTodayTag || dayStatus.hasPartialBlockOnDay
                            ? "text-amber-600"
                            : "text-emerald-700"
                        }`}
                      />
                      {isBlockedByVacationOrDayOff ? (
                        <span className="font-semibold flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold">
                            {dayStatus.closureCode === "VACATION"
                              ? "🏖️ En vacaciones programadas"
                              : dayStatus.closureCode === "STAFF_PAUSED"
                              ? "🏖️ Agenda en pausa"
                              : "⛔ Día cerrado por bloqueo"}
                          </span>
                          {hasHours && (
                            <span className="text-[11px] font-medium text-red-700/80">
                              (Turno habitual: {baseScheduleText})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="font-semibold">
                          {isAll ? "Equipo: " : "Atención: "}
                          <span className="font-extrabold">{scheduleText}</span>
                        </span>
                      )}
                      {dayStatus.hasPartialBlockOnDay && !isBlockedByVacationOrDayOff && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Horario ajustado
                        </span>
                      )}
                      {showClosedTodayTag && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Ya cerró
                        </span>
                      )}
                      {focusedStaff && !isBlockedByVacationOrDayOff && (
                        <button
                          type="button"
                          onClick={() => openShiftsEditor(focusedStaff, dayOfWeek)}
                          className="ml-0.5 px-2 py-0.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-[11px] font-bold text-[#1F1F23] inline-flex items-center gap-1 shadow-2xs transition-all"
                          title={`Modificar horario de ${focusedStaff.displayName} para este día`}
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          <span>{hasHours ? "Modificar" : "Configurar"}</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              <span className="text-xs font-semibold text-zinc-500 capitalize">
                {new Date(`${agendaDateStr}T00:00:00`).toLocaleDateString("es-ES", {
                  weekday: "long",
                })}
              </span>
            </div>

            {/* Quick 7-Day Pills with Appointment Count Badges */}
            <div className="overflow-x-auto no-scrollbar pill-slider flex items-center gap-1.5 py-1">
              {Array.from({ length: 7 }).map((_, idx) => {
                const d = new Date();
                d.setDate(d.getDate() + idx);
                const dStr = formatLocalDateYYYYMMDD(d);
                const shortDays = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
                const dayLabel = idx === 0 ? "Hoy" : idx === 1 ? "Mañ" : shortDays[d.getDay()];
                const isSel = dStr === agendaDateStr;
                const count = allAppointments.filter((a: any) => {
                  const aStr = formatLocalDateYYYYMMDD(new Date(a.startAt));
                  const matchesStaff =
                    !selectedStaffId ||
                    selectedStaffId === "ALL" ||
                    a.staffId === selectedStaffId;
                  return (
                    aStr === dStr &&
                    matchesStaff &&
                    (a.status === "CONFIRMED" || a.status === "RESCHEDULED_BY_STAFF")
                  );
                }).length;

                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => setAgendaDateStr(dStr)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isSel
                        ? "bg-[#1F1F23] text-white shadow-md"
                        : count > 0
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                    }`}
                  >
                    <span>
                      {dayLabel} {d.getDate()}
                    </span>
                    {count > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          isSel
                            ? "bg-emerald-400 text-zinc-900"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active TimeOff / Bloqueos de Agenda para la fecha seleccionada */}
          {(() => {
            const activeStaffObj = staffList.find((s: any) => s.id === selectedStaffId);
            const dayStart = new Date(`${agendaDateStr}T00:00:00`);
            const dayEnd = new Date(`${agendaDateStr}T23:59:59`);
            const dayBlocks = (
              selectedStaffId === "ALL"
                ? staffList.flatMap((st: any) => st.timeOffs || [])
                : activeStaffObj?.timeOffs || []
            ).filter((to: any) => {
              const s = new Date(to.startAt);
              const e = new Date(to.endAt);
              return s <= dayEnd && e >= dayStart;
            });

            if (dayBlocks.length === 0) return null;

            return (
              <div className="space-y-2">
                {dayBlocks.map((to: any) => {
                  const s = new Date(to.startAt);
                  const e = new Date(to.endAt);
                  const isFullDay =
                    s.getHours() === 0 &&
                    s.getMinutes() === 0 &&
                    e.getHours() === 23 &&
                    e.getMinutes() >= 58;
                  return (
                    <div
                      key={to.id}
                      className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 flex-wrap shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5 text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-red-950">
                            {to.type === "VACATION"
                              ? `🏖️ Vacaciones programadas (${agendaDateStr})`
                              : isFullDay
                              ? `⛔ Día cerrado (${agendaDateStr})`
                              : `⏳ Horario bloqueado: ${s.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })} - ${e.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}`}
                          </div>
                          <div className="text-[11px] text-red-800 mt-0.5">
                            Motivo: <b>{to.reason || (to.type === "VACATION" ? "Vacaciones programadas" : "Imprevisto de agenda")}</b>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTimeOff(to.id)}
                        className="px-3 py-1.5 rounded-full bg-white hover:bg-red-100 text-red-700 border border-red-300 text-[11px] font-bold transition-all shadow-2xs"
                      >
                        🔓 Reabrir horario / Quitar bloqueo
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Appointments List for the day */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                <span>Citas de la Fecha ({dayAppointments.length})</span>
                <span className="text-[11px] font-semibold text-zinc-400 normal-case">
                  • {selectedStaffId === "ALL"
                    ? "Todo el equipo"
                    : staffList.find((s: any) => s.id === selectedStaffId)?.displayName || "doctor seleccionado"}
                </span>
              </h3>

              {(() => {
                const pendingDayApts = dayAppointments.filter(
                  (a: any) =>
                    a.status === "CONFIRMED" ||
                    a.status === "RESCHEDULED_BY_STAFF"
                );
                if (pendingDayApts.length === 0) return null;
                return (
                  <button
                    type="button"
                    onClick={() => handleCancelAllDayAppointments(pendingDayApts)}
                    className="px-3 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold transition-all shadow-2xs"
                  >
                    ✕ Cancelar todas las de esta fecha ({pendingDayApts.length})
                  </button>
                );
              })()}
            </div>

            {/* Filter pills bar: Pendientes, Atendidas, No Asistió, Todas */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pill-slider py-1">
              {[
                {
                  id: "pending",
                  label: "Pendientes",
                  count: dayAppointments.filter(
                    (a: any) =>
                      a.status === "CONFIRMED" ||
                      a.status === "RESCHEDULED_BY_STAFF"
                  ).length,
                },
                {
                  id: "completed",
                  label: "✓ Atendidas",
                  count: dayAppointments.filter(
                    (a: any) => a.status === "COMPLETED"
                  ).length,
                },
                {
                  id: "noshow",
                  label: "⚠️ No asistió",
                  count: dayAppointments.filter(
                    (a: any) => a.status === "NO_SHOW"
                  ).length,
                },
                {
                  id: "all",
                  label: "Todas",
                  count: dayAppointments.length,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAdminAptFilter(f.id as any)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                    adminAptFilter === f.id
                      ? "bg-[#1F1F23] text-white shadow-sm"
                      : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      adminAptFilter === f.id
                        ? "bg-white/20 text-white"
                        : "bg-zinc-300 text-zinc-800"
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {(() => {
              const filteredApts = dayAppointments.filter((a: any) => {
                if (adminAptFilter === "pending")
                  return (
                    a.status === "CONFIRMED" ||
                    a.status === "RESCHEDULED_BY_STAFF"
                  );
                if (adminAptFilter === "completed")
                  return a.status === "COMPLETED";
                if (adminAptFilter === "noshow") return a.status === "NO_SHOW";
                return true;
              });

              if (filteredApts.length === 0) {
                const otherStaffActiveApts =
                  isOwnerAdmin && selectedStaffId && selectedStaffId !== "ALL"
                    ? allAppointments.filter((a: any) => {
                        const aStr = formatLocalDateYYYYMMDD(new Date(a.startAt));
                        return (
                          aStr === agendaDateStr &&
                          a.staffId !== selectedStaffId &&
                          (a.status === "CONFIRMED" ||
                            a.status === "RESCHEDULED_BY_STAFF")
                        );
                      })
                    : [];

                return (
                  <div className="space-y-3">
                    {otherStaffActiveApts.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                        <div className="text-xs text-amber-950 space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5">
                            <span>🔔</span>
                            <span>
                              Hay {otherStaffActiveApts.length} cita(s) activa(s) hoy ({agendaDateStr}) con otro profesional:
                            </span>
                          </div>
                          <div className="text-[11px] text-amber-900">
                            {otherStaffActiveApts
                              .map(
                                (a: any) =>
                                  `${a.staff?.displayName || "Doctor"} (${new Date(
                                    a.startAt
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })} • ${a.customer?.name || "Cliente"})`
                              )
                              .join(" — ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStaffId(otherStaffActiveApts[0].staffId)
                            }
                            className="px-3 py-1.5 rounded-full bg-[#1F1F23] hover:bg-black text-white text-[11px] font-bold transition-all shadow-2xs"
                          >
                            Ver agenda de {otherStaffActiveApts[0].staff?.displayName}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedStaffId("ALL")}
                            className="px-3 py-1.5 rounded-full bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-[11px] font-bold transition-all"
                          >
                            👥 Ver todo el equipo
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="py-7 px-4 text-center text-xs text-zinc-500 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-1.5">
                      <div className="font-semibold text-zinc-700">
                        No hay citas{" "}
                        {adminAptFilter === "pending"
                          ? "pendientes de atender"
                          : adminAptFilter === "completed"
                          ? "atendidas"
                          : adminAptFilter === "noshow"
                          ? "con inasistencia"
                          : ""}{" "}
                        para esta fecha ({agendaDateStr})
                        {selectedStaffId && selectedStaffId !== "ALL" && (
                          <span> con {staffList.find((s: any) => s.id === selectedStaffId)?.displayName}</span>
                        )}.
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Si buscas una cita de otro día (ej. sábado), selecciónalo en los botones de fecha arriba (&quot;Mañ 7&quot;, etc.).
                      </p>
                    </div>
                  </div>
                );
              }

              return filteredApts.map((apt: any) => {
                const isPastTime = new Date(apt.startAt) < new Date();
                const isPending =
                  apt.status === "CONFIRMED" ||
                  apt.status === "RESCHEDULED_BY_STAFF";
                const isCompleted = apt.status === "COMPLETED";
                const isNoShow = apt.status === "NO_SHOW";
                const isCancelled = apt.status === "CANCELLED";

                return (
                  <div
                    key={apt.id}
                    className={`p-4 rounded-3xl border shadow-sm space-y-2.5 transition-all ${
                      isCompleted
                        ? "border-emerald-300 bg-emerald-50/70"
                        : isNoShow
                        ? "border-amber-300 bg-amber-50/70"
                        : isCancelled
                        ? "border-zinc-200 bg-zinc-50 opacity-70"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    {isPending && isPastTime && (
                      <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-zinc-950 inline-flex items-center gap-1 shadow-sm">
                        <span>⏳</span>
                        <span>
                          Horario transcurrido • Requiere marcar Atendida o No
                          se presentó
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1F1F23]">
                          {new Date(apt.startAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-xs text-zinc-500">
                          ({apt.service?.durationMin} min)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700">
                          {apt.service?.name}
                        </span>
                        {selectedStaffId === "ALL" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            🩺 {apt.staff?.displayName}
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isCompleted
                            ? "bg-emerald-600 text-white"
                            : isNoShow
                            ? "bg-amber-600 text-white"
                            : isCancelled
                            ? "bg-zinc-600 text-white"
                            : apt.status === "RESCHEDULED_BY_STAFF"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isCompleted
                          ? "✓ ATENDIDA"
                          : isNoShow
                          ? "⚠️ NO ASISTIÓ"
                          : apt.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-700">
                      <div>
                        Cliente: <b>{apt.customer?.name || "Cliente"}</b>
                        {apt.customer?.noShowCount > 0 && (
                          <span className="ml-1 text-[11px] text-amber-700 font-semibold">
                            ({apt.customer.noShowCount} inasistencia
                            {apt.customer.noShowCount > 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                      {apt.customer?.phone && (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${apt.customer.phone}`}
                            className="flex items-center gap-1 text-zinc-600 hover:text-black font-medium"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Llamar</span>
                          </a>
                          <a
                            href={`https://wa.me/${apt.customer.phone.replace(
                              /\D/g,
                              ""
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {apt.customerNotes && (
                      <div className="p-2.5 rounded-2xl bg-sky-50/80 border border-sky-200 text-xs text-sky-950 flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block">
                            Nota / detalle del cliente:
                          </span>
                          <p className="text-xs text-zinc-800 break-words leading-snug mt-0.5">
                            {apt.customerNotes}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions for Doctor */}
                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2 flex-wrap">
                      {isPending && (
                        <>
                          <button
                            onClick={() =>
                              handleStatusChange(apt.id, "COMPLETED")
                            }
                            className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Atendida</span>
                          </button>
                          <button
                            onClick={() => setNoShowModalData(apt)}
                            className="px-3 py-1.5 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span>No se presentó</span>
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(apt.id, "CANCELLED")
                            }
                            className="px-2.5 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => {
                              handleStatusChange(apt.id, "CANCELLED");
                              window.open(getWhatsAppCancelUrl(apt), "_blank");
                            }}
                            className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                            title="Cancela la cita y abre WhatsApp con el mensaje listo"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            <span>Cancelar y avisar</span>
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                            <Check className="w-4 h-4" /> Cita finalizada con éxito
                          </span>
                          <button
                            onClick={() =>
                              handleStatusChange(apt.id, "CONFIRMED")
                            }
                            className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs hover:bg-zinc-200"
                          >
                            ↩ Revertir a pendiente
                          </button>
                        </div>
                      )}

                      {isNoShow && (
                        <div className="flex items-center justify-between w-full flex-wrap gap-2">
                          <span className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />{" "}
                            Inasistencia asentada
                          </span>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={getWhatsAppNoShowUrl(apt)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                            <button
                              onClick={() =>
                                handleStatusChange(apt.id, "CONFIRMED")
                              }
                              className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs hover:bg-zinc-200"
                            >
                              ↩ Revertir
                            </button>
                          </div>
                        </div>
                      )}

                      {isCancelled && (
                        <a
                          href={getWhatsAppCancelUrl(apt)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                          title="Avisar al cliente por WhatsApp con mensaje pre-redactado"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                          <span>Avisar por WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* TAB 2: MIS HORARIOS SEMANALES & MARGEN (EDITABLE Y REAL) */}
      {activeTab === "shifts" && (
        <div className="p-4 space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-zinc-200">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-900" />
                <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Horarios de Atención Semanales
                </h2>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Configurando la agenda de: <b>{selectedStaff?.displayName}</b>
                {selectedStaff?.specialtyTitle ? ` (${selectedStaff.specialtyTitle})` : ""}
              </p>
            </div>

            {/* Selector de profesional para Admin y Botón Modificar / Guardar */}
            <div className="flex items-center gap-2 flex-wrap">
              {isOwnerAdmin && !isEditingShifts && (
                <select
                  value={selectedStaffId}
                  onChange={(e) => {
                    setSelectedStaffId(e.target.value);
                    setIsEditingShifts(false);
                  }}
                  className="text-base sm:text-xs font-bold bg-zinc-100 border border-zinc-300 text-zinc-800 rounded-full px-3 py-1.5 focus:outline-none max-w-full"
                  title="Cambiar profesional para editar sus horarios"
                >
                  {staffList.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              )}

              {!isEditingShifts ? (
                <button
                  type="button"
                  onClick={startEditingShifts}
                  className="px-4 py-2 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modificar Horarios</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingShifts(false)}
                    className="px-3.5 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={savingShifts}
                    onClick={handleSaveShifts}
                    className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingShifts ? "Guardando..." : "Guardar Cambios"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta de Disponibilidad / Modo Vacaciones */}
          <div
            className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
              selectedStaff?.isActive
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                : "bg-amber-50 border-amber-300 text-amber-950 shadow-sm"
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-2xl flex-shrink-0">
                {selectedStaff?.isActive ? "🟢" : "🏖️"}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">
                    {selectedStaff?.isActive
                      ? "Agenda Activa (Disponible para reservas)"
                      : "Modo Vacaciones / Agenda en Pausa"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      selectedStaff?.isActive
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-amber-200 text-amber-900"
                    }`}
                  >
                    {selectedStaff?.isActive ? "Visible al público" : "Oculto para clientes"}
                  </span>
                </div>
                <p className="text-xs opacity-85 mt-0.5">
                  {selectedStaff?.isActive
                    ? "Tu perfil está visible en el portal y los clientes pueden agendar en tus horarios habilitados."
                    : "Estás temporalmente oculto del portal de reservas. Los clientes no pueden verte ni reservar citas contigo."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                handleToggleStaffActive(selectedStaff.id, !selectedStaff.isActive)
              }
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedStaff?.isActive
                  ? "bg-white hover:bg-amber-100 text-amber-900 border border-amber-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {selectedStaff?.isActive ? (
                <>
                  <span>🏖️</span>
                  <span>Pausar Agenda Inmediata</span>
                </>
              ) : (
                <>
                  <span>🟢</span>
                  <span>Reanudar Agenda (Volver a recibir citas)</span>
                </>
              )}
            </button>
          </div>

          {/* Tarjeta de Vacaciones Programadas a Futuro (Rango de Fechas) */}
          <div className="p-4 rounded-3xl border border-zinc-200 bg-white shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg flex-shrink-0">
                  🏖️
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900">
                    Periodos de Vacaciones Programadas a Futuro
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Planifica tus vacaciones con anticipación (ej. bloquear enero o febrero). Seguirás atendiendo normalmente hoy hasta que comience tu periodo de receso.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setVacationModal({
                    open: true,
                    staffId: selectedStaff?.id || selectedStaffId,
                    startDate: "",
                    endDate: "",
                    reason: "",
                  })
                }
                className="flex-shrink-0 px-4 py-2 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>+ Programar Vacaciones</span>
              </button>
            </div>

            {/* Lista de periodos programados para este profesional */}
            {(() => {
              const myVacations = (selectedStaff?.timeOffs || []).filter(
                (to: any) =>
                  to.type === "VACATION" ||
                  new Date(to.endAt).getTime() - new Date(to.startAt).getTime() > 24 * 3600 * 1000
              );

              if (myVacations.length === 0) {
                return (
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-500 text-center">
                    No tienes periodos de vacaciones programados. Puedes planificarlos con semanas o meses de anticipación.
                  </div>
                );
              }

              return (
                <div className="space-y-2 pt-1">
                  {myVacations.map((vac: any) => {
                    const startD = new Date(vac.startAt);
                    const endD = new Date(vac.endAt);
                    const diffDays =
                      Math.ceil(
                        (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)
                      ) || 1;
                    const isCurrent = startD <= new Date() && endD >= new Date();
                    const isPast = endD < new Date();

                    return (
                      <div
                        key={vac.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between text-xs flex-wrap gap-2 ${
                          isCurrent
                            ? "bg-amber-50 border-amber-300 text-amber-950 font-medium"
                            : isPast
                            ? "bg-zinc-50 border-zinc-200 text-zinc-400"
                            : "bg-blue-50/70 border-blue-200 text-blue-950"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">🏖️</span>
                          <div>
                            <div className="font-bold flex items-center gap-2 flex-wrap">
                              <span>
                                {vac.reason || "Vacaciones programadas"} ({diffDays} {diffDays === 1 ? "día" : "días"})
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase">
                                  En curso ahora
                                </span>
                              )}
                              {!isCurrent && !isPast && (
                                <span className="px-2 py-0.2 rounded-full bg-blue-200 text-blue-900 text-[10px] font-extrabold uppercase">
                                  Programada a futuro
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] opacity-80 mt-0.5">
                              📅 Del {startD.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}{" "}
                              al {endD.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          </div>
                        </div>

                        {!isPast && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTimeOff(vac.id)}
                            className="px-3 py-1.5 rounded-full bg-white hover:bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold transition-all shadow-2xs"
                          >
                            🔓 Cancelar y reabrir fechas
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Banner de Edición Activa */}
          {isEditingShifts && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Modo Edición Activado:</span> Puedes encender o apagar días,
                ajustar horas de inicio y fin, o agregar turnos partidos (mañana y tarde). Al terminar, pulsa{" "}
                <b>Guardar Cambios</b> para que los pacientes vean los nuevos cupos disponibles.
              </div>
            </div>
          )}

          {/* Margen de Aviso y Ventana de Reserva */}
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs text-zinc-600 space-y-3">
            <div className="font-bold text-zinc-900 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-zinc-600" />
              <span>Reglas de Antelación y Ventana de Reserva</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-zinc-200">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                  Ventana máxima de reserva
                </label>
                {!isEditingShifts ? (
                  <div className="font-bold text-sm text-zinc-900">
                    {selectedStaff?.customHorizonDays ?? settings?.bookingHorizonDays ?? 7} días de anticipación
                  </div>
                ) : (
                  <select
                    value={editingHorizonDays}
                    onChange={(e) => setEditingHorizonDays(Number(e.target.value))}
                    className="w-full text-base sm:text-xs font-semibold bg-zinc-50 border border-zinc-300 rounded-lg p-2 focus:outline-none"
                  >
                    <option value={3}>3 días hacia adelante</option>
                    <option value={7}>7 días (1 semana - Recomendado)</option>
                    <option value={14}>14 días (2 semanas)</option>
                    <option value={21}>21 días (3 semanas)</option>
                    <option value={30}>30 días (1 mes)</option>
                    <option value={60}>60 días (2 meses)</option>
                  </select>
                )}
                <span className="text-[10px] text-zinc-400 block mt-1">
                  Los pacientes solo podrán agendar dentro de esta ventana de tiempo.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-zinc-200">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                  Margen mínimo de aviso previo
                </label>
                {!isEditingShifts ? (
                  <div className="font-bold text-sm text-zinc-900">
                    {(selectedStaff?.customLeadTimeMin ?? settings?.minLeadTimeMinutes ?? 30) === 0
                      ? "Sin anticipación (En cualquier momento / Inmediato)"
                      : `${selectedStaff?.customLeadTimeMin ?? settings?.minLeadTimeMinutes ?? 30} minutos antes`}
                  </div>
                ) : (
                  <select
                    value={editingLeadTimeMin}
                    onChange={(e) => setEditingLeadTimeMin(Number(e.target.value))}
                    className="w-full text-base sm:text-xs font-semibold bg-zinc-50 border border-zinc-300 rounded-lg p-2 focus:outline-none"
                  >
                    <option value={0}>Sin anticipación (En cualquier momento / Inmediato - 0 min)</option>
                    <option value={15}>15 minutos antes (Urgencias / Rápido)</option>
                    <option value={30}>30 minutos antes (Estándar)</option>
                    <option value={60}>60 minutos antes (1 hora)</option>
                    <option value={120}>120 minutos antes (2 horas)</option>
                    <option value={240}>240 minutos antes (4 horas)</option>
                    <option value={1440}>24 horas de antelación</option>
                  </select>
                )}
                <span className="text-[10px] text-zinc-400 block mt-1">
                  Tiempo mínimo de margen antes de una cita para que un cliente pueda agendar. Si eliges &quot;Sin anticipación&quot;, los pacientes pueden agendar en cualquier momento para el mismo día de inmediato.
                </span>
              </div>
            </div>
          </div>

          {/* Banner de Validación de Criterios de Aceptación (Solo en modo edición si hay errores) */}
          {isEditingShifts && !shiftsValidation.isValid && (
            <div className="p-3.5 bg-red-50 border border-red-300 rounded-2xl flex items-start gap-2.5 text-xs text-red-900 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-red-800">
                  ⚠️ Criterios de Aceptación: Se detectaron {shiftsValidation.errors.length} error(es) en los horarios:
                </span>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-red-700">
                  {shiftsValidation.errors.map((err, i) => (
                    <li key={i}>{err.message}</li>
                  ))}
                </ul>
                <span className="text-[10px] text-red-600 font-semibold block mt-1.5">
                  Debes corregir los horarios en rojo antes de poder guardar los cambios.
                </span>
              </div>
            </div>
          )}

          {/* Plantillas Rápidas (Solo en modo edición) */}
          {isEditingShifts && (
            <div className="p-3 bg-zinc-100 rounded-2xl border border-zinc-200/80 space-y-2">
              <span className="text-[11px] font-bold text-zinc-600 block uppercase tracking-wider">
                ⚡ Plantillas y Acciones Rápidas
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleApplyPreset("continua")}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-800 text-[11px] font-semibold border border-zinc-300 shadow-2xs transition-all"
                >
                  Jornada Continua (09:00 - 18:00 Lun-Vie)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("partido")}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-800 text-[11px] font-semibold border border-zinc-300 shadow-2xs transition-all"
                >
                  Turno Partido (09:00-13:00 y 15:00-19:00)
                </button>
                <button
                  type="button"
                  onClick={handleCopyMondayToWeek}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-800 text-[11px] font-semibold border border-zinc-300 shadow-2xs transition-all"
                  title="Copia los turnos configurados en el Lunes al resto de días laborables (Mar, Mié, Jue, Vie)"
                >
                  Copiar Lunes a toda la semana
                </button>
              </div>
            </div>
          )}

          {/* Lista de Días de la Semana */}
          <div className="space-y-2.5">
            {[
              { day: 1, name: "Lunes" },
              { day: 2, name: "Martes" },
              { day: 3, name: "Miércoles" },
              { day: 4, name: "Jueves" },
              { day: 5, name: "Viernes" },
              { day: 6, name: "Sábado" },
              { day: 0, name: "Domingo" },
            ].map((d) => {
              if (!isEditingShifts) {
                // MODO VISTA
                const dayShifts = (selectedStaff?.workingShifts || [])
                  .filter((s: any) => s.dayOfWeek === d.day)
                  .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
                const isWorking = dayShifts.length > 0;

                return (
                  <div
                    key={d.day}
                    className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between text-xs transition-all hover:border-zinc-300"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-zinc-900 text-sm">{d.name}</span>
                      <div>
                        {isWorking ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {dayShifts.map((s: any, idx: number) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 font-semibold text-[11px] border border-zinc-200/80"
                              >
                                {s.startTime} - {s.endTime}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">
                            Cerrado (Sin atención a pacientes)
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {isWorking ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Atiende ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-400">
                          Cerrado
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // MODO EDICIÓN
              const dayShifts = editingShiftsList.filter((s) => s.dayOfWeek === d.day);
              const isWorking = dayShifts.length > 0;
              const dayErrors = shiftsValidation.dayErrors[d.day] || [];
              const hasDayErrors = dayErrors.length > 0;

              return (
                <div
                  key={d.day}
                  id={`shift-day-${d.day}`}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    highlightedShiftDay === d.day ? "ring-2 ring-amber-400 " : ""
                  }${
                    hasDayErrors
                      ? "bg-red-50/30 border-red-400 shadow-xs"
                      : isWorking
                      ? "bg-white border-zinc-300 shadow-2xs"
                      : "bg-zinc-50/70 border-zinc-200 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900 text-sm">{d.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleDay(d.day)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${
                          isWorking
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                        }`}
                      >
                        {isWorking ? "✓ Atiende este día" : "○ Cerrado"}
                      </button>

                      {hasDayErrors && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          Requiere corrección
                        </span>
                      )}
                    </div>

                    {isWorking && (
                      <button
                        type="button"
                        disabled={dayShifts.length >= 3}
                        onClick={() => handleAddShiftToDay(d.day)}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          dayShifts.length >= 3
                            ? "text-zinc-300 cursor-not-allowed"
                            : "text-zinc-700 hover:text-black hover:underline"
                        }`}
                        title={dayShifts.length >= 3 ? "Máximo 3 turnos por día permitidos" : "Agregar turno adicional (partido)"}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{dayShifts.length >= 3 ? "Límite 3 turnos" : "Agregar turno (partido)"}</span>
                      </button>
                    )}
                  </div>

                  {isWorking ? (
                    <div className="space-y-2 mt-2">
                      {dayShifts.map((shift, idx) => {
                        const sMin = timeToMinutes(shift.startTime);
                        const eMin = timeToMinutes(shift.endTime);
                        const isInverted = sMin !== -1 && eMin !== -1 && sMin >= eMin;
                        const isTooShort = sMin !== -1 && eMin !== -1 && !isInverted && (eMin - sMin < 30);
                        const isCorruptFormat = sMin === -1 || eMin === -1;

                        // Check overlap with other shifts on this same day
                        const hasOverlap = dayShifts.some((other) => {
                          if (other.tempId === shift.tempId) return false;
                          const oStart = timeToMinutes(other.startTime);
                          const oEnd = timeToMinutes(other.endTime);
                          if (oStart === -1 || oEnd === -1 || oStart >= oEnd) return false;
                          if (sMin === -1 || eMin === -1 || isInverted) return false;
                          return sMin < oEnd && eMin > oStart;
                        });

                        const hasShiftError = isInverted || isTooShort || isCorruptFormat || hasOverlap;

                        return (
                          <div
                            key={shift.tempId || idx}
                            className={`p-2.5 rounded-xl border text-xs transition-all ${
                              hasShiftError
                                ? "bg-red-50/70 border-red-400"
                                : "bg-[#F4F4F6] border-zinc-200"
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-semibold text-zinc-500 w-14">
                                Turno {idx + 1}:
                              </span>

                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-zinc-400">De</label>
                                <input
                                  type="time"
                                  required
                                  value={shift.startTime}
                                  onChange={(e) =>
                                    handleUpdateShiftTime(shift.tempId, "startTime", e.target.value)
                                  }
                                  className={`rounded-lg px-2 py-1 font-bold text-base sm:text-xs focus:outline-none transition-all ${
                                    hasShiftError
                                      ? "bg-white border-2 border-red-500 text-red-900"
                                      : "bg-white border border-zinc-300 text-zinc-800"
                                  }`}
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-zinc-400">a</label>
                                <input
                                  type="time"
                                  required
                                  value={shift.endTime}
                                  onChange={(e) =>
                                    handleUpdateShiftTime(shift.tempId, "endTime", e.target.value)
                                  }
                                  className={`rounded-lg px-2 py-1 font-bold text-base sm:text-xs focus:outline-none transition-all ${
                                    hasShiftError
                                      ? "bg-white border-2 border-red-500 text-red-900"
                                      : "bg-white border border-zinc-300 text-zinc-800"
                                  }`}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveSpecificShift(shift.tempId)}
                                className="ml-auto p-1 text-zinc-400 hover:text-red-600 transition-all"
                                title="Eliminar este tramo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Alertas específicas en línea */}
                            {isInverted && (
                              <div className="mt-1.5 p-1.5 bg-red-100 text-red-900 text-[10px] font-bold rounded-md flex items-center gap-1.5 border border-red-200">
                                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span>
                                  Horario imposible: La hora de inicio ({shift.startTime}) no puede ser igual o posterior a la hora de fin ({shift.endTime}).
                                </span>
                              </div>
                            )}

                            {isTooShort && (
                              <div className="mt-1.5 p-1.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-md flex items-center gap-1.5 border border-amber-200">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>
                                  Duración insuficiente: El turno dura solo {eMin - sMin} min. La duración mínima es de 30 minutos.
                                </span>
                              </div>
                            )}

                            {hasOverlap && (
                              <div className="mt-1.5 p-1.5 bg-red-100 text-red-900 text-[10px] font-bold rounded-md flex items-center gap-1.5 border border-red-200">
                                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span>
                                  Solapamiento: Este turno choca con otro turno del mismo día. Separa o une los turnos.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-400 italic">
                      Día de descanso o cerrado. Pulsa el botón de arriba si deseas habilitar atención este día.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Botones inferiores al editar */}
          {isEditingShifts && (
            <div className="pt-3 flex items-center justify-between sticky bottom-4 z-20 bg-white/95 backdrop-blur-xs p-3 rounded-2xl border border-zinc-200 shadow-lg">
              <div>
                {!shiftsValidation.isValid ? (
                  <span className="text-[11px] font-bold text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{shiftsValidation.errors.length} error(es) en horarios. No es posible guardar.</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Horarios validados según criterios de aceptación.</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingShifts(false)}
                  className="px-4 py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-all"
                >
                  Descartar Cambios
                </button>
                <button
                  type="button"
                  disabled={!shiftsValidation.isValid || savingShifts}
                  onClick={handleSaveShifts}
                  className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                  title={!shiftsValidation.isValid ? "Corrige los errores señalados en rojo antes de guardar" : "Guardar horarios semanales"}
                >
                  <Save className="w-4 h-4" />
                  <span>{savingShifts ? "Guardando en agenda..." : "Guardar Horarios Semanales"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2.5: EQUIPO / PERSONAL (ROLES ADMIN VS DOCTOR) */}
      {activeTab === "team" && isOwnerAdmin && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">
                Equipo Profesional y Accesos ({staffList.length})
              </h2>
              <p className="text-[11px] text-zinc-500">
                Autoriza el correo Google de tu equipo ({settings?.staffLabel?.toLowerCase() || "profesionales"} o colaboradores) para que gestionen su propia agenda sin modificar los datos del negocio.
              </p>
            </div>
            <button
              onClick={() =>
                setStaffModal({
                  displayName: "",
                  specialty: "",
                  email: "",
                  phone: "+591",
                  bio: "",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80",
                  serviceIds: services.map((s: any) => s.id),
                })
              }
              className="px-3.5 py-2 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Profesional</span>
            </button>
          </div>

          {/* Lista de Profesionales */}
          <div className="space-y-3">
            {staffList.map((st: any, idx: number) => {
              const linkedUser =
                st.user ||
                allUsers.find((u: any) => u.id === st.userId) ||
                null;
              const isPrimaryOwner =
                linkedUser?.role === "ADMIN" || idx === 0;

              return (
                <div
                  key={st.id}
                  className="p-4 rounded-3xl border border-zinc-200 bg-white shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          st.avatarUrl ||
                          "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80"
                        }
                        alt={st.displayName}
                        className="w-12 h-12 rounded-full object-cover border border-zinc-300"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-zinc-900">
                            {st.displayName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPrimaryOwner
                                ? "bg-[#1F1F23] text-white"
                                : "bg-emerald-100 text-emerald-950 border border-emerald-300"
                            }`}
                          >
                            {isPrimaryOwner
                              ? "👑 ADMIN / DUEÑO"
                              : "🩺 PROFESIONAL AUTORIZADO"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              st.isActive
                                ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                                : "bg-amber-100 text-amber-950 border border-amber-300"
                            }`}
                          >
                            {st.isActive ? "🟢 ACTIVO" : "🏖️ EN VACACIONES"}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-zinc-600 mt-0.5">
                          {st.specialtyTitle || st.specialty || "Especialista"}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          📧 Login Google:{" "}
                          <b className="text-zinc-800">
                            {linkedUser?.email || "Sin correo vinculado"}
                          </b>
                          {linkedUser?.phone ? ` • 📱 ${linkedUser.phone}` : ""}
                        </div>
                        {(() => {
                          const futureVacations = (st.timeOffs || [])
                            .filter(
                              (to: any) =>
                                to.type === "VACATION" ||
                                new Date(to.endAt).getTime() -
                                  new Date(to.startAt).getTime() >
                                  24 * 3600 * 1000
                            )
                            .filter((to: any) => new Date(to.endAt) >= new Date());

                          if (futureVacations.length === 0) return null;

                          return (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              {futureVacations.map((v: any) => (
                                <span
                                  key={v.id}
                                  className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold"
                                >
                                  🏖️ Vacaciones:{" "}
                                  {new Date(v.startAt).toLocaleDateString("es-ES", {
                                    day: "numeric",
                                    month: "short",
                                  })}{" "}
                                  al{" "}
                                  {new Date(v.endAt).toLocaleDateString("es-ES", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Permisos resumidos */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 font-semibold">
                      ✓ Atender citas propias
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 font-semibold">
                      ✓ Bloquear imprevistos y horarios
                    </span>
                    {isPrimaryOwner ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 font-bold">
                        ✓ Editar Logo, Local, Precios y Equipo
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-700 font-medium">
                        🔒 Sin acceso a Ajustes del Local ni Precios
                      </span>
                    )}
                  </div>

                  {/* Servicios asignados al profesional (1-Clic para habilitar o bloquear) */}
                  {(() => {
                    const myServices = services.filter(
                      (s: any) =>
                        st.services?.some((rel: any) => rel.serviceId === s.id) ||
                        s.staff?.some((rel: any) => rel.staffId === st.id)
                    );
                    const myServiceIds = myServices.map((s: any) => s.id);
                    return (
                      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] flex-wrap gap-1.5">
                          <span className="font-bold text-zinc-800">
                            🩺 Servicios habilitados para {st.displayName} ({myServices.length} de{" "}
                            {services.length}) — <span className="text-zinc-500 font-medium">Clic para activar/bloquear:</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {myServices.length < services.length && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetAllStaffServices(
                                    st,
                                    services.map((s: any) => s.id)
                                  )
                                }
                                className="px-2.5 py-0.5 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-[10px] font-bold transition-all"
                              >
                                Habilitar todos
                              </button>
                            )}
                            {myServices.length === 0 && (
                              <span className="text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                ⚠️ Sin servicios asignados
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {services.map((s: any) => {
                            const isEnabled = myServiceIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleToggleStaffService(st, s)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 ${
                                  isEnabled
                                    ? "bg-[#1F1F23] text-white shadow-2xs hover:bg-black"
                                    : "bg-white border border-dashed border-zinc-300 text-zinc-400 hover:text-zinc-700 hover:border-zinc-400"
                                }`}
                                title={
                                  isEnabled
                                    ? `Clic para bloquear "${s.name}" a ${st.displayName}`
                                    : `Clic para habilitar "${s.name}" a ${st.displayName}`
                                }
                              >
                                <span>{isEnabled ? "✓" : "○"}</span>
                                <span>{s.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Botones de Acción */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a
                        href={getWhatsAppStaffInviteUrl(st)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        <span>Enviar invitación WhatsApp</span>
                      </a>

                      {linkedUser && (
                        <button
                          type="button"
                          onClick={() => handlePreviewStaffSession(linkedUser.id)}
                          className="px-3 py-1.5 rounded-full bg-zinc-200 hover:bg-zinc-300 text-[#1F1F23] text-[11px] font-bold transition-all"
                        >
                          👁️ Ver como {st.displayName}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleStaffActive(st.id, !st.isActive)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer ${
                          st.isActive
                            ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        {st.isActive ? "Pausar cuenta" : "🟢 Reanudar atención"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setVacationModal({
                            open: true,
                            staffId: st.id,
                            startDate: "",
                            endDate: "",
                            reason: "",
                          })
                        }
                        className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-all shadow-2xs"
                      >
                        🏖️ Programar Vacaciones
                      </button>
                    </div>

                    {!isPrimaryOwner && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(st.id, st.displayName)}
                        className="px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Revocar acceso</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SERVICIOS & PRECIOS */}
      {/* TAB 3: SERVICIOS & PRECIOS */}
      {activeTab === "services" && isOwnerAdmin && (
        <ServicesCatalogTab
          services={services}
          staffList={staffList}
          currencySymbol={settings?.currencySymbol || "$"}
          onOpenNewService={() =>
            setServiceModal({
              name: "",
              description: "",
              durationMin: 30,
              bufferAfterMin: 0,
              price: 30,
              staffIds: staffList.map((s: any) => s.id),
            })
          }
          onOpenEditService={(svc, currentStaffIds) =>
            setServiceModal({
              id: svc.id,
              name: svc.name,
              description: svc.description || "",
              durationMin: svc.durationMin,
              bufferAfterMin: svc.bufferAfterMin ?? 0,
              price: svc.price,
              isActive: svc.isActive ?? true,
              staffIds: currentStaffIds,
            })
          }
          onToggleServiceStaff={handleToggleServiceStaff}
        />
      )}

      {/* TAB 4: CLIENTES & ANTI-TROLLS */}
      {activeTab === "customers" && isOwnerAdmin && (
        <CustomerControlTab
          allUsers={allUsers}
          custFilter={custFilter}
          onChangeFilter={setCustFilter}
          onResetUserStrikes={handleResetUserStrikes}
          onToggleBlockUser={handleToggleBlockUser}
        />
      )}

      {/* TAB 5: AJUSTES TEMPLATE WHITE-LABEL */}
      {activeTab === "settings" && isOwnerAdmin && (
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">
                Ajustes del Negocio y Marca
              </h2>
              <p className="text-[11px] text-zinc-500">
                Exclusivo para el Dueño / Administrador Principal
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="self-start sm:self-auto px-4 min-h-[38px] py-2 rounded-full bg-[#1F1F23] text-white text-xs font-semibold flex items-center gap-1.5 shadow-md hover:bg-black whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingSettings ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>

          <div className="space-y-3">
            {/* EDITOR DE LOGO DEL NEGOCIO (CENTRO DE LA IDENTIDAD) */}
            <div className="p-4 rounded-3xl bg-zinc-50 border-[1.5px] border-[#1F1F23] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[10px] font-extrabold text-zinc-700 uppercase tracking-wider block">
                    Logo e Identidad Visual del Local
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Sube tu propio logo o elige un icono rápido por rubro. Se actualiza en toda la app.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1F1F23] bg-zinc-100 flex-shrink-0 shadow-sm">
                  <img
                    src={
                      settingsForm?.logoUrl ||
                      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=200&auto=format&fit=crop&q=80"
                    }
                    alt="Vista previa del logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-xs font-bold text-zinc-900 truncate">
                    {settingsForm?.name || "Nombre del Negocio"}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {settingsForm?.tagline || "Subtítulo del negocio"}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <label className="cursor-pointer px-3 py-1.5 rounded-full bg-[#1F1F23] hover:bg-black text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs transition-all">
                      <span>📁 Subir imagen / Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Presets rápidos de rubro */}
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
                  O elige una imagen rápida según tu rubro:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    {
                      label: "🦷 Dental",
                      url: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=200&auto=format&fit=crop&q=80",
                    },
                    {
                      label: "🩺 Médico",
                      url: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=200&auto=format&fit=crop&q=80",
                    },
                    {
                      label: "💈 Barbería",
                      url: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200&auto=format&fit=crop&q=80",
                    },
                    {
                      label: "✨ Estética",
                      url: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=200&auto=format&fit=crop&q=80",
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setSettingsForm({ ...settingsForm, logoUrl: preset.url })
                      }
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                        settingsForm?.logoUrl === preset.url
                          ? "bg-[#1F1F23] text-white border-[#1F1F23]"
                          : "bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                  URL directa del Logo (opcional)
                </label>
                <input
                  type="url"
                  value={settingsForm?.logoUrl || ""}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, logoUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="mt-1 w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-base sm:text-xs text-zinc-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="border-[1.5px] border-[#1F1F23] bg-[#F4F4F6] rounded-2xl px-4 py-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                Nombre del Negocio
              </label>
              <input
                type="text"
                value={settingsForm?.name || ""}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, name: e.target.value })
                }
                className="bg-transparent font-semibold text-base sm:text-sm text-[#1F1F23] focus:outline-none w-full"
              />
            </div>

            <div className="border-[1.5px] border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                Eslogan o Subtítulo
              </label>
              <input
                type="text"
                value={settingsForm?.tagline || ""}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, tagline: e.target.value })
                }
                className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border-[1.5px] border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Etiqueta de Profesionales
                </label>
                <input
                  type="text"
                  value={settingsForm?.staffLabel || ""}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, staffLabel: e.target.value })
                  }
                  placeholder="Doctor(a) / Barbero"
                  className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
                />
              </div>

              <div className="border-[1.5px] border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Símbolo de Moneda
                </label>
                <input
                  type="text"
                  value={settingsForm?.currencySymbol || "$"}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      currencySymbol: e.target.value,
                    })
                  }
                  className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="border-[1.5px] border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                Dirección Física
              </label>
              <input
                type="text"
                value={settingsForm?.addressText || ""}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, addressText: e.target.value })
                }
                className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
              />
            </div>

            {/* Interactive Map Picker & Google Maps Integration */}
            <div className="p-3.5 bg-white rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    Ubicación Interactiva en el Mapa
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Haz clic en cualquier punto del mapa, arrastra el pin o busca una calle para fijar la ubicación exacta.
                  </p>
                </div>
              </div>

              <InteractiveMapPicker
                initialUrl={settingsForm?.googleMapsUrl}
                onLocationChange={(lat, lng, googleMapsUrl, suggestedAddress) => {
                  setSettingsForm((prev: any) => ({
                    ...prev,
                    googleMapsUrl,
                    ...(suggestedAddress && (!prev.addressText || prev.addressText.includes("Simón López"))
                      ? { addressText: suggestedAddress }
                      : {}),
                  }));
                }}
                height="240px"
              />

              <div className="border-[1.5px] border-zinc-200 bg-[#F4F4F6] rounded-xl px-3 py-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-0.5">
                  Enlace Generado de Google Maps (Sincronizado Automáticamente)
                </label>
                <input
                  type="url"
                  value={settingsForm?.googleMapsUrl || ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      googleMapsUrl: e.target.value,
                    })
                  }
                  placeholder="https://www.google.com/maps/search/?api=1&query=..."
                  className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="border-[1.5px] border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                Teléfono / WhatsApp de Notificaciones
              </label>
              <input
                type="text"
                value={settingsForm?.phoneWhatsapp || ""}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    phoneWhatsapp: e.target.value,
                  })
                }
                className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
              />
            </div>

            {/* Políticas Generales de la Clínica (Valores por Defecto) */}
            <div className="p-4.5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-zinc-600" />
                  <span>Reglas Predeterminadas de la Clínica (Valores Base)</span>
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Estas son las reglas generales del negocio. Se aplican por defecto a los nuevos doctores o a quienes no tengan reglas personalizadas en su pestaña &quot;Mis Horarios&quot;. Cada doctor puede definir su propia ventana y antelación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="border-[1.5px] border-zinc-300 bg-white rounded-2xl px-4 py-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Ventana de Reserva Base (Días)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={settingsForm?.bookingHorizonDays || 7}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bookingHorizonDays: Number(e.target.value),
                      })
                    }
                    className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
                  />
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Anticipación máxima por defecto
                  </span>
                </div>

                <div className="border-[1.5px] border-zinc-300 bg-white rounded-2xl px-4 py-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Aviso Previo Mínimo Base
                  </label>
                  <select
                    value={settingsForm?.minLeadTimeMinutes ?? 30}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        minLeadTimeMinutes: Number(e.target.value),
                      })
                    }
                    className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full cursor-pointer"
                  >
                    <option value={0}>0 min (Inmediato / En cualquier momento)</option>
                    <option value={15}>15 minutos antes</option>
                    <option value={30}>30 minutos antes</option>
                    <option value={60}>60 minutos (1 hora)</option>
                    <option value={120}>120 minutos (2 horas)</option>
                    <option value={1440}>24 horas antes</option>
                  </select>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Margen de antelación para el mismo día
                  </span>
                </div>

                <div className="border-[1.5px] border-zinc-300 bg-white rounded-2xl px-4 py-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Horas Mínimas Cancelación
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={72}
                    value={settingsForm?.minCancelNoticeHours || 6}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        minCancelNoticeHours: Number(e.target.value),
                      })
                    }
                    className="bg-transparent font-medium text-base sm:text-xs text-[#1F1F23] focus:outline-none w-full"
                  />
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Regla global para cancelar sin falta
                  </span>
                </div>
              </div>
            </div>

            {/* Vista Previa Automática en Google, Favicons y WhatsApp (SEO / Open Graph) */}
            <div className="p-4.5 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    SEO en Google y Tarjeta Open Graph (WhatsApp)
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Sincronizado automáticamente con tu logo, nombre, servicios y ubicación guardados.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Indexación Activa ✓
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Google Search Snippet Preview */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-3.5 space-y-1.5 shadow-2xs">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Vista previa en Google
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Direct preview of dynamic generated favicon endpoint */}
                    <img
                      src={`/icon/48?v=${settings?.updatedAt ? new Date(settings.updatedAt).getTime() : 1}`}
                      alt="Favicon"
                      className="w-5 h-5 rounded-md border border-zinc-200 object-cover"
                    />
                    <span className="text-[11px] text-zinc-600 truncate">
                      {settingsForm?.name || "Clínica Dental"}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#1a0dab] leading-snug line-clamp-1">
                    {`${settingsForm?.name || "Clínica Dental"} | Reserva tu Cita Online`}
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-2">
                    {`${settingsForm?.tagline || "Reserva tu cita en línea en segundos"}. Agenda tu turno con confirmación inmediata en ${settingsForm?.addressText || "tu ciudad"}.`}
                  </p>
                </div>

                {/* WhatsApp Open Graph Card Preview */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Tarjeta WhatsApp (Open Graph 1200×630)
                    </span>
                    <a
                      href={`/opengraph-image?v=${settings?.updatedAt ? new Date(settings.updatedAt).getTime() : 1}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-emerald-700 hover:underline"
                    >
                      Abrir imagen ↗
                    </a>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Direct preview of dynamic generated 1200x630 Open Graph PNG */}
                    <img
                      src={`/opengraph-image?v=${settings?.updatedAt ? new Date(settings.updatedAt).getTime() : 1}`}
                      alt="Vista previa Open Graph para WhatsApp"
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK IMPREVISTO MODAL */}
      {imprevistoModal.open && (() => {
        const now = new Date();
        const activeModalStaffId = imprevistoModal.staffId || selectedStaffId;
        const modalValidation = validateScheduleOverride({
          type: imprevistoModal.type,
          dateStr: agendaDateStr,
          timeStr: imprevistoModal.timeStr,
          targets: resolveOverrideTargets(activeModalStaffId),
          isAllTargets: activeModalStaffId === "ALL",
          now,
        });
        const openModalAlternatives = isOwnerAdmin
          ? staffList.filter(
              (st: any) =>
                st.id !== activeModalStaffId &&
                !getDayScheduleStatus({
                  dateStr: agendaDateStr,
                  targets: [st],
                  now,
                }).isDayClosedAlready
            )
          : [];
        const activeDateAptsAllStaff = allAppointments.filter((a: any) => {
          const aStr = formatLocalDateYYYYMMDD(new Date(a.startAt));
          return (
            aStr === agendaDateStr &&
            (a.status === "CONFIRMED" || a.status === "RESCHEDULED_BY_STAFF")
          );
        });
        const modalTargetApts = activeDateAptsAllStaff.filter((a: any) =>
          activeModalStaffId === "ALL" ? true : a.staffId === activeModalStaffId
        );
        const otherStaffWithApts =
          activeModalStaffId !== "ALL"
            ? activeDateAptsAllStaff.filter((a: any) => a.staffId !== activeModalStaffId)
            : [];

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] p-5 sm:p-6 max-w-sm w-full shadow-2xl relative max-h-[92dvh] overflow-y-auto">
              <h3 className="text-base font-bold text-zinc-900">
                {imprevistoModal.type === "LATE_START" && "🌅 Entrar más tarde hoy"}
                {imprevistoModal.type === "EARLY_LEAVE" && "🎂 Salir antes / Cumpleaños"}
                {imprevistoModal.type === "FULL_DAY_OFF" && "🏖️ Cerrar día completo"}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Configura el bloqueo temporal para el <b>{agendaDateStr}</b>.
              </p>

              <div className="mt-4 space-y-3">
                {!modalValidation.valid && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-300 text-xs text-red-900 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-red-800">
                      <span>🔒 Bloqueo no disponible</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{modalValidation.error}</p>
                    {openModalAlternatives.length > 0 && modalValidation.status.isDayClosedAlready && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {openModalAlternatives.map((st: any) => {
                          const altStatus = getDayScheduleStatus({
                            dateStr: agendaDateStr,
                            targets: [st],
                            now,
                          });
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() =>
                                setImprevistoModal({
                                  ...imprevistoModal,
                                  staffId: st.id,
                                  timeStr: getSuggestedOverrideTime(
                                    imprevistoModal.type,
                                    altStatus,
                                    now
                                  ),
                                })
                              }
                              className="px-2.5 py-1 rounded-full bg-[#1F1F23] text-white text-[10px] font-bold hover:bg-black"
                            >
                              Cambiar a {st.displayName} (hasta {altStatus.latestEndStr})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {isOwnerAdmin && staffList.length > 1 && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      ¿A qué agenda aplica este cierre / imprevisto?
                    </label>
                    <select
                      value={activeModalStaffId}
                      onChange={(e) => {
                        const nextStaffId = e.target.value;
                        const nextStatus = getDayScheduleStatus({
                          dateStr: agendaDateStr,
                          targets: resolveOverrideTargets(nextStaffId),
                          isAllTargets: nextStaffId === "ALL",
                          now,
                        });
                        setImprevistoModal({
                          ...imprevistoModal,
                          staffId: nextStaffId,
                          timeStr: getSuggestedOverrideTime(
                            imprevistoModal.type,
                            nextStatus,
                            now
                          ),
                        });
                      }}
                      className="w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-xs bg-white focus:outline-none cursor-pointer"
                    >
                      {staffList.map((st: any) => {
                        const stCount = activeDateAptsAllStaff.filter(
                          (a: any) => a.staffId === st.id
                        ).length;
                        const stDayStatus = getDayScheduleStatus({
                          dateStr: agendaDateStr,
                          targets: [st],
                          now,
                        });
                        const stClosedNote = stDayStatus.isDayClosedAlready
                          ? ` · ${stDayStatus.closedBadge || "Cerrado"}`
                          : "";
                        return (
                          <option key={st.id} value={st.id}>
                            {st.displayName} ({stCount} cita{stCount === 1 ? "" : "s"} hoy{stClosedNote})
                          </option>
                        );
                      })}
                      <option value="ALL">
                        👥 Todo el equipo / Cerrar clínica ({activeDateAptsAllStaff.length} cita{activeDateAptsAllStaff.length === 1 ? "" : "s"} hoy)
                      </option>
                    </select>
                  </div>
                )}

                {isOwnerAdmin &&
                  modalValidation.valid &&
                  modalTargetApts.length === 0 &&
                  otherStaffWithApts.length > 0 && (
                    <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-[11px] text-amber-950 space-y-2">
                      <div>
                        ⚠️ <b>Atención:</b> El profesional seleccionado tiene <b>0 citas</b> para el {agendaDateStr}, pero <b>{otherStaffWithApts[0].staff?.displayName}</b> tiene <b>{otherStaffWithApts.length} cita(s) activa(s)</b> hoy.
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setImprevistoModal({
                              ...imprevistoModal,
                              staffId: otherStaffWithApts[0].staffId,
                            })
                          }
                          className="px-2.5 py-1 rounded-full bg-[#1F1F23] text-white text-[10px] font-bold hover:bg-black"
                        >
                          Cambiar a {otherStaffWithApts[0].staff?.displayName}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setImprevistoModal({
                              ...imprevistoModal,
                              staffId: "ALL",
                            })
                          }
                          className="px-2.5 py-1 rounded-full bg-white border border-amber-300 text-amber-950 text-[10px] font-bold hover:bg-amber-100"
                        >
                          👥 Cerrar todo el equipo
                        </button>
                      </div>
                    </div>
                  )}

                {modalTargetApts.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-red-50 border border-red-200 text-[11px] text-red-950 space-y-1">
                    <div className="font-bold">
                      📋 {modalTargetApts.length} cita(s) activa(s) en esta fecha:
                    </div>
                    {modalTargetApts.slice(0, 3).map((a: any) => (
                      <div key={a.id} className="text-[10px] text-red-800">
                        •{" "}
                        {new Date(a.startAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        — <b>{a.customer?.name}</b> ({a.service?.name})
                      </div>
                    ))}
                  </div>
                )}

                {imprevistoModal.type !== "FULL_DAY_OFF" && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      {imprevistoModal.type === "LATE_START"
                        ? "Atenderé a partir de las:"
                        : "Cerrar atención a partir de las:"}
                    </label>
                    <input
                      type="time"
                      disabled={modalValidation.status.isDayClosedAlready}
                      value={imprevistoModal.timeStr}
                      onChange={(e) =>
                        setImprevistoModal({
                          ...imprevistoModal,
                          timeStr: e.target.value,
                        })
                      }
                      className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-sm disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
                    />
                    {modalValidation.status.hasShiftsOnDay && !modalValidation.status.isDayClosedAlready && (
                      <span className="text-[10px] text-zinc-400 block mt-1">
                        Horario regular de esta fecha: {modalValidation.status.earliestStartStr} - {modalValidation.status.latestEndStr}
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Motivo (Visible si hay que avisar a pacientes)
                  </label>
                  <input
                    type="text"
                    disabled={modalValidation.status.isDayClosedAlready}
                    value={imprevistoModal.reason}
                    onChange={(e) =>
                      setImprevistoModal({
                        ...imprevistoModal,
                        reason: e.target.value,
                      })
                    }
                    placeholder="Ej. Cumpleaños / Trámite personal"
                    className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 text-base sm:text-xs font-medium disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {modalTargetApts.length > 0 &&
                  imprevistoModal.type !== "LATE_START" && (
                    <button
                      type="button"
                      disabled={!modalValidation.valid}
                      onClick={() => handleQuickImprevisto("CANCEL_ALL")}
                      className="w-full py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ⛔ Cerrar día, cancelar {modalTargetApts.length} cita(s) y notificar
                    </button>
                  )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!modalValidation.valid}
                    onClick={() => handleQuickImprevisto()}
                    className="flex-1 py-3 rounded-full bg-[#1F1F23] text-white text-xs font-semibold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Aplicar Bloqueo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setImprevistoModal({ ...imprevistoModal, open: false })
                    }
                    className="py-3 px-4 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-zinc-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONFLICT DETECTED MODAL */}
      {conflictData?.open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] p-5 sm:p-6 max-w-sm w-full shadow-2xl border-2 border-amber-500 max-h-[92dvh] overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-zinc-900">
              ¡Conflicto de Citas Detectado!
            </h3>
            <p className="text-xs text-zinc-600 text-center mt-1 leading-relaxed">
              Tienes <b>{conflictData.conflicts.length} cita(s) agendada(s)</b> en el
              horario que deseas bloquear:
            </p>

            <div className="my-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs max-h-36 overflow-y-auto space-y-2">
              {conflictData.conflicts.map((c: any) => (
                <div key={c.id} className="pb-1.5 border-b border-zinc-200 last:border-0">
                  <div className="font-bold text-zinc-900">
                    {c.customer?.name} ({c.service?.name})
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Hora: {new Date(c.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Tel: {c.customer?.phone}
                  </div>
                  {c.customerNotes && (
                    <div className="mt-1 text-[11px] text-sky-900 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1 break-words">
                      <b>Nota:</b> {c.customerNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[10px] text-zinc-500 text-center mb-4">
              ¿Qué deseas hacer con estas citas?
            </p>

            <div className="space-y-2">
              {conflictData.type === "LATE_START" ? (
                <button
                  onClick={() => handleQuickImprevisto("MOVE_TO_END")}
                  className="w-full py-3 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-semibold shadow-md flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mover citas a la nueva hora de entrada y notificar</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 text-center">
                  Al cerrar el resto del día o la jornada completa, las citas afectadas deben cancelarse para notificar a los pacientes y permitirles elegir una nueva fecha.
                </div>
              )}

              <button
                onClick={() =>
                  conflictData.type === "VACATION"
                    ? handleScheduleVacation("CANCEL_ALL")
                    : handleQuickImprevisto("CANCEL_ALL")
                }
                className="w-full py-2.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold"
              >
                Cancelar citas afectadas y notificar al cliente
              </button>

              <button
                onClick={() => setConflictData(null)}
                className="w-full py-2 rounded-full text-zinc-500 text-xs font-medium hover:bg-zinc-100"
              >
                Volver atrás sin bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VACATION DATE RANGE MODAL */}
      {vacationModal.open && (() => {
        const vacTargetId = vacationModal.staffId || selectedStaffId;
        const vacTargets = resolveOverrideTargets(vacTargetId);
        const hasBothDates = Boolean(vacationModal.startDate && vacationModal.endDate);
        const vacCheck = validateVacationRange({
          startDate: vacationModal.startDate,
          endDate: vacationModal.endDate || vacationModal.startDate,
          targets: vacTargets,
          now: new Date(),
        });
        const canSubmitVacation = hasBothDates && vacCheck.valid;

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] p-5 sm:p-6 max-w-sm w-full shadow-2xl relative border border-zinc-200 max-h-[92dvh] overflow-y-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2 text-2xl">
                🏖️
              </div>
              <h3 className="text-base font-bold text-center text-zinc-900">
                Programar Vacaciones o Receso
              </h3>
              <p className="text-xs text-zinc-500 text-center mt-1">
                Selecciona el rango de fechas. El sistema bloqueará automáticamente nuevas reservas en ese periodo, mientras sigues atendiendo con normalidad hoy.
              </p>

              <div className="mt-4 space-y-3 text-xs">
                {vacationModal.startDate && !vacCheck.valid && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-300 text-xs text-red-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-red-800">
                      <span>🔒 Rango no disponible</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{vacCheck.error}</p>
                  </div>
                )}

                {/* Doctor / Staff selection if Admin */}
                {isOwnerAdmin && staffList.length > 1 && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      Profesional
                    </label>
                    <select
                      value={vacationModal.staffId || selectedStaffId}
                      onChange={(e) =>
                        setVacationModal({ ...vacationModal, staffId: e.target.value })
                      }
                      className="w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-xs bg-white focus:outline-none"
                    >
                      {staffList.map((st: any) => (
                        <option key={st.id} value={st.id}>
                          {st.displayName} ({st.specialtyTitle || "Especialista"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      Desde (Inicio)
                    </label>
                    <input
                      type="date"
                      min={formatLocalDateYYYYMMDD(new Date())}
                      value={vacationModal.startDate}
                      onChange={(e) =>
                        setVacationModal({ ...vacationModal, startDate: e.target.value })
                      }
                      className="w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      Hasta (Retorno)
                    </label>
                    <input
                      type="date"
                      min={vacationModal.startDate || formatLocalDateYYYYMMDD(new Date())}
                      value={vacationModal.endDate}
                      onChange={(e) =>
                        setVacationModal({ ...vacationModal, endDate: e.target.value })
                      }
                      className="w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                    Motivo / Nota (Opcional · visible para pacientes)
                  </label>
                  <input
                    type="text"
                    value={vacationModal.reason}
                    onChange={(e) =>
                      setVacationModal({ ...vacationModal, reason: e.target.value })
                    }
                    placeholder="Ej. Vacaciones de verano / Viaje / Congreso"
                    className="w-full p-2.5 rounded-2xl border border-zinc-300 text-base sm:text-xs focus:outline-none"
                  />
                </div>

                {hasBothDates &&
                  vacCheck.valid &&
                  vacationModal.startDate <= vacationModal.endDate && (() => {
                    const totalDays =
                      Math.ceil(
                        (new Date(vacationModal.endDate).getTime() -
                          new Date(vacationModal.startDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      ) + 1;
                    return (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                        🏖️ Se {totalDays === 1 ? "bloqueará 1 día" : `bloquearán ${totalDays} días`} para reservas en línea.
                      </div>
                    );
                  })()}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={!canSubmitVacation}
                  onClick={() => handleScheduleVacation()}
                  className="flex-1 py-3 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirmar Vacaciones
                </button>
                <button
                  type="button"
                  onClick={() => setVacationModal((prev) => ({ ...prev, open: false }))}
                  className="py-3 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* NEW / EDIT SERVICE MODAL */}
      {serviceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] p-5 sm:p-6 max-w-md w-full shadow-2xl relative max-h-[92dvh] overflow-y-auto">
            <h3 className="text-base font-bold text-zinc-900">
              {serviceModal.id ? "Editar Servicio" : "Crear Nuevo Servicio"}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {serviceModal.id
                ? "Modifica el nombre, duración, precio y qué especialistas lo realizan."
                : "Agrega un servicio con su duración, precio y profesionales asignados."}
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Nombre del Servicio
                </label>
                <input
                  type="text"
                  value={serviceModal.name}
                  onChange={(e) =>
                    setServiceModal({ ...serviceModal, name: e.target.value })
                  }
                  placeholder="Ej. Corte Fade + Barba"
                  className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 font-semibold text-base sm:text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={serviceModal.description}
                  onChange={(e) =>
                    setServiceModal({
                      ...serviceModal,
                      description: e.target.value,
                    })
                  }
                  placeholder="Detalle breve del servicio"
                  className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 text-base sm:text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    value={serviceModal.durationMin}
                    onChange={(e) =>
                      setServiceModal({
                        ...serviceModal,
                        durationMin: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Buffer Limpieza (min)
                  </label>
                  <input
                    type="number"
                    value={serviceModal.bufferAfterMin}
                    onChange={(e) =>
                      setServiceModal({
                        ...serviceModal,
                        bufferAfterMin: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-sm focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-400 block mt-1 leading-tight">
                    Usa 0 min para citas continuas (ej. 9:00 y 9:30).
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Precio ({settings?.currencySymbol || "$"})
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={serviceModal.price}
                  onChange={(e) =>
                    setServiceModal({
                      ...serviceModal,
                      price: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 font-bold text-base sm:text-sm focus:outline-none"
                />
              </div>

              {/* ASIGNACIÓN DE ESPECIALISTAS / DOCTORES QUE REALIZAN ESTE SERVICIO */}
              <div className="pt-2 border-t border-zinc-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-zinc-700 uppercase block">
                    ¿Quiénes realizan este servicio?
                  </label>
                  <span className="text-[10px] text-zinc-500 font-bold">
                    {(serviceModal.staffIds || []).length} de {staffList.length} asignados
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Solo los profesionales marcados podrán recibir citas de este servicio. A los demás se les bloqueará automáticamente.
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-zinc-50 rounded-2xl border border-zinc-200">
                  {staffList.map((st: any) => {
                    const isChecked = (serviceModal.staffIds || []).includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                          isChecked
                            ? "bg-white border border-zinc-300 shadow-2xs"
                            : "hover:bg-zinc-100/70"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentIds = serviceModal.staffIds || [];
                              const next = e.target.checked
                                ? [...currentIds, st.id]
                                : currentIds.filter((id: string) => id !== st.id);
                              setServiceModal({
                                ...serviceModal,
                                staffIds: next,
                              });
                            }}
                            className="w-4 h-4 rounded text-zinc-900 accent-zinc-900 cursor-pointer"
                          />
                          <span className="font-bold text-zinc-800 text-xs">
                            {st.displayName}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          {st.specialtyTitle || "Especialista"}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {(serviceModal.staffIds || []).length === 0 && (
                  <p className="text-[10px] text-amber-700 font-bold mt-1.5">
                    ⚠️ Si no seleccionas a ningún profesional, este servicio no se mostrará para reservas en el portal.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={async () => {
                  if (!serviceModal.name || serviceModal.name.trim().length < 3) {
                    showToast("warning", "Nombre inválido", "El nombre del servicio debe tener al menos 3 caracteres.");
                    return;
                  }
                  if (!serviceModal.durationMin || serviceModal.durationMin < 5 || serviceModal.durationMin > 480) {
                    showToast("warning", "Duración inválida", "La duración debe estar entre 5 y 480 minutos.");
                    return;
                  }
                  if (serviceModal.price < 0) {
                    showToast("warning", "Precio inválido", "El precio no puede ser negativo.");
                    return;
                  }
                  try {
                    const isEdit = Boolean(serviceModal.id);
                    const res = await fetch("/api/admin/services", {
                      method: isEdit ? "PUT" : "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...serviceModal,
                        staffIds: serviceModal.staffIds || [],
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      showToast("error", "No se pudo guardar", data.error || "Error al guardar el servicio.");
                      return;
                    }
                    setServiceModal(null);
                    showToast(
                      "success",
                      isEdit ? "¡Servicio Actualizado!" : "¡Servicio Creado!",
                      isEdit
                        ? "Los cambios del servicio y profesionales asignados se guardaron correctamente."
                        : "El nuevo servicio se ha añadido correctamente al catálogo."
                    );
                    onRefresh();
                  } catch (e: any) {
                    showToast("error", "Error", e.message);
                  }
                }}
                className="flex-1 py-3 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-semibold"
              >
                {serviceModal.id ? "Guardar Cambios" : "Crear Servicio"}
              </button>
              <button
                onClick={() => setServiceModal(null)}
                className="py-3 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR Y AUTORIZAR NUEVO PROFESIONAL / DOCTOR */}
      {staffModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] p-5 sm:p-6 max-w-sm w-full shadow-2xl relative border border-zinc-200 max-h-[92dvh] overflow-y-auto">
            <h3 className="text-base font-bold text-zinc-900">
              👨‍⚕️ Agregar Profesional al Equipo
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Pre-autoriza el correo de Google del nuevo doctor o empleado. Al iniciar sesión, tendrá acceso restringido solo a su agenda y horarios.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                  Nombre Completo / Título *
                </label>
                <input
                  type="text"
                  value={staffModal.displayName}
                  onChange={(e) =>
                    setStaffModal({ ...staffModal, displayName: e.target.value })
                  }
                  placeholder="Ej. Dr. Marcos Paz / Lic. Valeria"
                  className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 font-semibold text-base sm:text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                  Especialidad o Cargo *
                </label>
                <input
                  type="text"
                  value={staffModal.specialty}
                  onChange={(e) =>
                    setStaffModal({ ...staffModal, specialty: e.target.value })
                  }
                  placeholder="Ej. Ortodoncia y Rehabilitación"
                  className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 text-base sm:text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                  Correo de Google (Para Login del Empleado) *
                </label>
                <input
                  type="email"
                  value={staffModal.email}
                  onChange={(e) =>
                    setStaffModal({ ...staffModal, email: e.target.value })
                  }
                  placeholder="ejemplo@gmail.com"
                  className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 text-base sm:text-xs font-semibold focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  Con este correo ingresará a su panel de atención.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                  Teléfono / WhatsApp del Profesional
                </label>
                <input
                  type="tel"
                  value={staffModal.phone}
                  onChange={(e) =>
                    setStaffModal({ ...staffModal, phone: e.target.value })
                  }
                  placeholder="+59170012345"
                  className="mt-1 w-full p-2.5 rounded-2xl border border-zinc-300 text-base sm:text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase block mb-1">
                  Foto de Perfil Rápida
                </label>
                <div className="flex items-center gap-2">
                  {[
                    "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80",
                    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80",
                    "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80",
                    "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=300&auto=format&fit=crop&q=80",
                  ].map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() =>
                        setStaffModal({ ...staffModal, avatarUrl: url })
                      }
                      className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${
                        staffModal.avatarUrl === url
                          ? "border-[#1F1F23] scale-105 shadow-md"
                          : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Servicios asignados al nuevo profesional */}
              {services.length > 0 && (
                <div className="pt-2 border-t border-zinc-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-zinc-700 uppercase block">
                      ¿Qué servicios realizará?
                    </label>
                    <span className="text-[10px] text-zinc-500 font-bold">
                      {(staffModal.serviceIds || []).length} de {services.length}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto p-2 bg-zinc-50 rounded-2xl border border-zinc-200">
                    {services.map((svc: any) => {
                      const isChecked = (staffModal.serviceIds || []).includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                            isChecked
                              ? "bg-white border border-zinc-300 shadow-2xs"
                              : "hover:bg-zinc-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const currentIds = staffModal.serviceIds || [];
                                const next = e.target.checked
                                  ? [...currentIds, svc.id]
                                  : currentIds.filter((id) => id !== svc.id);
                                setStaffModal({
                                  ...staffModal,
                                  serviceIds: next,
                                });
                              }}
                              className="w-4 h-4 rounded text-zinc-900 accent-zinc-900 cursor-pointer"
                            />
                            <span className="font-bold text-zinc-800 text-xs">
                              {svc.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-semibold">
                            {settings?.currencySymbol || "$"}
                            {svc.price}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleCreateStaff}
                disabled={savingStaff}
                className="flex-1 py-3 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold shadow-md"
              >
                {savingStaff ? "Autorizando..." : "Autorizar y Crear Cuenta"}
              </button>
              <button
                onClick={() => setStaffModal(null)}
                className="py-3 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR INASISTENCIA (NO SHOW) & LIMITES */}
      {noShowModalData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] p-5 sm:p-6 max-w-sm w-full shadow-2xl border-2 border-amber-400 max-h-[92dvh] overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-center text-zinc-900">
              Registrar Inasistencia
            </h3>
            <p className="text-xs text-zinc-600 text-center mt-1 leading-relaxed">
              El paciente o cliente no se presentó a su horario reservado.
            </p>

            <div className="my-3.5 p-3.5 bg-zinc-100 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-zinc-900">
                {noShowModalData.customer?.name || "Cliente"} •{" "}
                {noShowModalData.customer?.phone || "Sin tel."}
              </div>
              <div className="text-zinc-600">
                {noShowModalData.service?.name} —{" "}
                {new Date(noShowModalData.startAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {noShowModalData.customerNotes && (
                <div className="mt-1.5 p-2 rounded-xl bg-white border border-zinc-200 text-[11px] text-zinc-700 break-words">
                  <b>Nota del cliente:</b> {noShowModalData.customerNotes}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-zinc-200 flex items-center justify-between">
                <span className="text-zinc-500">Inasistencias registradas:</span>
                <span className="font-bold text-amber-800">
                  {noShowModalData.customer?.noShowCount || 0} acumulada(s)
                </span>
              </div>
              {(noShowModalData.customer?.noShowCount || 0) + 1 >= 2 && (
                <div className="mt-2.5 p-2 bg-red-100 border border-red-300 rounded-xl text-red-900 font-semibold text-[11px] leading-tight flex items-start gap-1.5">
                  <span>🛡️</span>
                  <div>
                    <b>Límite del sistema activado:</b> Al registrar esta falta acumulará 2 inasistencias y su cuenta será <b>bloqueada automáticamente</b> para nuevas reservas online.
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-4">
              <a
                href={getWhatsAppNoShowUrl(noShowModalData)}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                <span>Avisar por WhatsApp y consultar motivo</span>
              </a>

              <button
                onClick={async () => {
                  await handleStatusChange(noShowModalData.id, "NO_SHOW");
                  setNoShowModalData(null);
                }}
                className="w-full py-3 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold shadow-md transition-all"
              >
                ⚠️ Confirmar Inasistencia (+1 Falta)
              </button>

              <button
                onClick={async () => {
                  await handleStatusChange(noShowModalData.id, "NO_SHOW", true);
                  setNoShowModalData(null);
                }}
                className="w-full py-2.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-all"
              >
                🚫 Registrar y Bloquear Cuenta de Inmediato
              </button>

              <button
                onClick={() => setNoShowModalData(null)}
                className="w-full py-2 rounded-full text-zinc-500 text-xs font-semibold hover:text-zinc-800"
              >
                Volver atrás sin cambios
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <ConfirmModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  User,
  AlertTriangle,
  Phone,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  X,
} from "lucide-react";
import BranchMap from "./BranchMap";
import { formatLocalDateYYYYMMDD } from "@/lib/date-utils";

interface ClientAppProps {
  initialData: any;
  onRefresh: () => void;
}

export function ClientApp({ initialData, onRefresh }: ClientAppProps) {
  const settings = initialData?.settings;
  const services = initialData?.services || [];
  const staffList = initialData?.staff || [];
  const currentUser = initialData?.currentUser;
  const userAppointments = initialData?.userAppointments || [];
  const notifications = initialData?.notifications || [];

  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>([]);

  const handleDismissNotification = async (notifId: string, aptId?: string) => {
    setDismissedNotifIds((prev) => [...prev, notifId, ...(aptId ? [aptId] : [])]);
    try {
      await fetch(`/api/notifications/${notifId}/read`, { method: "POST" });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Error dismissing notification:", e);
    }
  };

  const [activeTab, setActiveTab] = useState<"book" | "my-appointments">("book");

  // Step-by-step mobile wizard:
  // 1 = Select Service
  // 2 = Select Staff (Con quién reservas)
  // 3 = Select Date & Time
  // 4 = Final Summary + Contact & Confirm
  // 5 = Confirmed Screen (Concentric circles)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Booking selections
  const [selectedService, setSelectedService] = useState<any>(services[0] || null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("ANY");
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser?.phone || "");
  const [customerNotes, setCustomerNotes] = useState<string>("");

  // Guest booking fields if not logged in
  const [guestName, setGuestName] = useState<string>("");
  const [guestEmail, setGuestEmail] = useState<string>("");
  const [guestPassword, setGuestPassword] = useState<string>("");

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");
  const [authPhone, setAuthPhone] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Slots loading
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Confirmed appointment result
  const [confirmedAppointment, setConfirmedAppointment] = useState<any>(null);

  // Map preview modal
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  // PWA Install modal & deferred prompt
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pwaInstalled, setPwaInstalled] = useState<boolean>(false);
  // Collapsible past history in My Appointments
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Cancellation modal for policy warning
  const [policyModal, setPolicyModal] = useState<{
    open: boolean;
    message: string;
    whatsappUrl: string;
  } | null>(null);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authEmail.trim() || !authEmail.includes("@")) {
      setAuthError("Ingresa un correo electrónico válido.");
      return;
    }
    if (!authPassword || authPassword.length < 6) {
      setAuthError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (authMode === "register" && (!authName.trim() || authName.trim().length < 2)) {
      setAuthError("Ingresa tu nombre completo.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? { email: authEmail.trim(), password: authPassword }
          : {
              name: authName.trim(),
              email: authEmail.trim(),
              password: authPassword,
              phone: authPhone.trim() || undefined,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({ error: "Error de respuesta del servidor." }));
      if (!res.ok) {
        setAuthError(data.error || "No se pudo completar la operación.");
        return;
      }
      setShowAuthModal(false);
      setAuthPassword("");
      onRefresh();
    } catch (err: any) {
      setAuthError(err.message || "Error al conectar con el servidor.");
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!selectedDateStr) {
      const today = new Date();
      setSelectedDateStr(formatLocalDateYYYYMMDD(today));
    }
  }, [selectedDateStr]);

  useEffect(() => {
    if (currentUser?.phone) {
      setCustomerPhone(currentUser.phone);
    }
  }, [currentUser]);

  // Fetch available slots when entering Step 3 or changing date/staff/service
  useEffect(() => {
    if (!selectedService?.id || !selectedDateStr) return;
    if (step !== 3 && step !== 4) return;

    let isMounted = true;
    setSlotsLoading(true);
    setBookingError(null);

    fetch(
      `/api/availability?serviceId=${selectedService.id}&staffId=${selectedStaffId}&date=${selectedDateStr}&_t=${Date.now()}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) return { slots: [] };
        return res.json().catch(() => ({ slots: [] }));
      })
      .then((data) => {
        if (!isMounted || !data) return;
        const slots: string[] = data.slots || [];
        setAvailableSlots(slots);
        setSelectedTime((prevTime) => {
          if (prevTime && slots.includes(prevTime)) {
            return prevTime;
          }
          return slots.length > 0 ? slots[0] : "";
        });
      })
      .catch((err) => console.error("Error fetching availability:", err))
      .finally(() => {
        if (isMounted) setSlotsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [step, selectedService?.id, selectedStaffId, selectedDateStr]);

  // Real-time synchronization: Re-validate slots periodically or when returning to browser tab
  useEffect(() => {
    if (step !== 3 || !selectedService?.id || !selectedDateStr) return;

    const refreshSlots = () => {
      fetch(
        `/api/availability?serviceId=${selectedService.id}&staffId=${selectedStaffId}&date=${selectedDateStr}&_t=${Date.now()}`,
        { cache: "no-store" }
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          const slots: string[] = data.slots || [];
          setAvailableSlots(slots);
          setSelectedTime((prevTime) => {
            if (prevTime && slots.includes(prevTime)) {
              return prevTime;
            }
            return slots.length > 0 ? slots[0] : "";
          });
        })
        .catch(() => {});
    };

    window.addEventListener("focus", refreshSlots);
    const interval = setInterval(refreshSlots, 12000);

    return () => {
      window.removeEventListener("focus", refreshSlots);
      clearInterval(interval);
    };
  }, [step, selectedService?.id, selectedStaffId, selectedDateStr]);

  const selectedStaffObj = staffList.find((s: any) => s.id === selectedStaffId);
  const horizonDays =
    (selectedStaffId !== "ANY" ? selectedStaffObj?.customHorizonDays : null) ??
    settings?.bookingHorizonDays ??
    7;
  const dateOptions: any[] = [];
  const today = new Date();
  const shortDays = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = formatLocalDateYYYYMMDD(d);
    const dayName =
      i === 0
        ? "Hoy"
        : i === 1
        ? "Mañana"
        : d.toLocaleDateString("es-ES", { weekday: "short" });
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString("es-ES", { month: "short" });
    dateOptions.push({
      dateStr,
      dayShort: i === 0 ? "HOY" : shortDays[d.getDay()],
      dayNumber,
      label: `${dayName} ${dayNumber} ${monthName}`,
      isToday: i === 0,
    });
  }

  const handleConfirmBooking = async () => {
    setBookingError(null);
    if (currentUser?.role === "PROVIDER") {
      setBookingError(
        `Las cuentas de ${settings?.staffLabel?.toLowerCase() || "profesionales"} no realizan reservas como pacientes. Accede a tu panel en /admin para gestionar tu agenda.`
      );
      return;
    }
    if (currentUser?.isBlocked) {
      setBookingError(
        "Tu cuenta se encuentra restringida para reservas en línea debido a inasistencias previas sin aviso. Por favor contacta al consultorio por WhatsApp."
      );
      return;
    }

    if (!currentUser) {
      if (!guestName.trim() || guestName.trim().length < 2) {
        setBookingError("Por favor ingresa tu nombre completo para confirmar la cita.");
        return;
      }
      if (!guestEmail.trim() || !guestEmail.includes("@")) {
        setBookingError("Por favor ingresa un correo electrónico válido.");
        return;
      }
      if (!guestPassword || guestPassword.length < 6) {
        setBookingError("Ingresa una contraseña de al menos 6 caracteres para proteger tu cuenta y tus citas.");
        return;
      }
    }

    if (!selectedService || !selectedDateStr || !selectedTime) {
      setBookingError("Por favor selecciona servicio, fecha y horario.");
      return;
    }

    const cleanDigits = (customerPhone || "").replace(/\D/g, "");
    if (cleanDigits.length < 8 || cleanDigits.length > 15) {
      setBookingError(
        "Ingresa un número de celular / WhatsApp válido (mínimo 8 dígitos numéricos)."
      );
      return;
    }

    setBookingLoading(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          staffId: selectedStaffId,
          date: selectedDateStr,
          time: selectedTime,
          customerName: currentUser?.name || guestName.trim(),
          customerEmail: currentUser?.email || guestEmail.trim(),
          customerPassword: currentUser ? undefined : guestPassword,
          customerPhone: customerPhone.trim(),
          customerNotes: customerNotes.trim().slice(0, 200),
        }),
      });

      const data = await res.json().catch(() => ({ error: "Error en la respuesta del servidor." }));
      if (!res.ok) {
        setBookingError(data.error || "No se pudo crear la reserva");
        return;
      }

      setConfirmedAppointment(data.appointment);
      setStep(5);
      onRefresh();
    } catch (e: any) {
      setBookingError(e.message || "Error al conectar con el servidor");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointment = async (aptId: string) => {
    try {
      const res = await fetch(`/api/appointments/${aptId}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({ error: "Error al cancelar." }));
      if (!res.ok) {
        setPolicyModal({
          open: true,
          message: data.error || "No es posible cancelar en este momento.",
          whatsappUrl: data.whatsappUrl || settings?.googleMapsUrl,
        });
        return;
      }
      onRefresh();
    } catch (e: any) {
      setPolicyModal({
        open: true,
        message: "Error al cancelar: " + e.message,
        whatsappUrl: settings?.googleMapsUrl || "#",
      });
    }
  };

  const handleAcknowledgeMove = async (aptId: string) => {
    try {
      const res = await fetch(`/api/appointments/${aptId}/ack-move`, {
        method: "POST",
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeCount = userAppointments.filter(
    (a: any) =>
      (a.status === "CONFIRMED" || a.status === "RESCHEDULED_BY_STAFF") &&
      new Date(a.startAt) >= new Date()
  ).length;

  const rescheduledByStaff = userAppointments.find(
    (a: any) => a.status === "RESCHEDULED_BY_STAFF"
  );

  const unreadCancelNotifs = notifications.filter(
    (n: any) =>
      !n.isRead &&
      !dismissedNotifIds.includes(n.id) &&
      n.type === "APPOINTMENT_CANCELLED"
  );
  const unreadCancelNotif = unreadCancelNotifs[0] || null;

  const cancelledByStaff = userAppointments.find(
    (a: any) =>
      a.status === "CANCELLED" &&
      Boolean(a.staffMoveReason) &&
      !dismissedNotifIds.includes(a.id) &&
      !notifications.some((n: any) => n.appointmentId === a.id && n.isRead)
  );

  const targetCancelledApt = unreadCancelNotif?.appointmentId
    ? userAppointments.find((a: any) => a.id === unreadCancelNotif.appointmentId)
    : cancelledByStaff;

  const targetAptDate = targetCancelledApt?.startAt ? new Date(targetCancelledApt.startAt) : null;
  const targetTimeStr = targetAptDate && !isNaN(targetAptDate.getTime())
    ? targetAptDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "";
  const targetDateStr = targetAptDate && !isNaN(targetAptDate.getTime())
    ? targetAptDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })
    : "";
  const targetServiceName = targetCancelledApt?.service?.name || "";
  const targetStaffName =
    targetCancelledApt?.staff?.displayName ||
    targetCancelledApt?.staff?.name ||
    "el profesional";
  const targetCancelReason = targetCancelledApt?.staffMoveReason || "";

  return (
    <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto min-h-screen md:min-h-0 md:my-6 md:rounded-[32px] bg-white text-[#1F1F23] pb-16 md:pb-8 shadow-2xl relative border-x md:border border-zinc-200/80 flex flex-col transition-all duration-300">
      {/* 1. Business Header (Shown on Step 1 or in My Appointments) */}
      {(activeTab === "my-appointments" || step === 1) && (
        <header className="px-5 pt-5 pb-3 md:px-8 md:pt-7 md:pb-5 bg-white border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-full overflow-hidden bg-zinc-200 flex-shrink-0 border border-zinc-300">
                {settings?.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-zinc-600 md:text-lg">
                    {settings?.name?.slice(0, 2).toUpperCase() || "RC"}
                  </div>
                )}
              </div>
              <div>
                <h1 className="font-bold text-base md:text-xl leading-tight text-[#1F1F23]">
                  {settings?.name || "Clínica & Reservas"}
                </h1>
                <p className="text-xs md:text-sm text-zinc-600">
                  {settings?.addressText || "Av. Simón López esq. Av. Beijing, Cochabamba"}
                </p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowMapModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] md:text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-0.5 rounded-full transition-all border border-rose-200/80 shadow-2xs"
                  >
                    <MapPin className="w-3 h-3 text-rose-600" />
                    <span>Ver mapa en la web</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPwaModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] md:text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-0.5 rounded-full transition-all border border-zinc-300 shadow-2xs"
                    title="Instalar como aplicación en tu celular"
                  >
                    <span>📲</span>
                    <span>{pwaInstalled ? "App Instalada ✓" : "Instalar App"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className={`h-10 md:h-11 px-3.5 md:px-4 rounded-full text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                  currentUser
                    ? "bg-[#1F1F23] text-white hover:bg-black"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300"
                }`}
                title={currentUser ? "Mi Cuenta" : "Iniciar Sesión"}
              >
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span className="max-w-[100px] truncate">
                  {currentUser ? currentUser.name?.split(" ")[0] : "Ingresar"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[#1F1F23] text-white flex items-center justify-center hover:bg-black transition-all shadow-sm"
                title="Ver Ubicación en Mapa"
              >
                <MapPin className="w-4 h-4 text-rose-400" />
              </button>
              {settings?.phoneWhatsapp && (
                <a
                  href={`https://wa.me/${settings.phoneWhatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-all shadow-sm"
                  title="Abrir WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Segmented Control in Pill (High Contrast WCAG AA) */}
          <div className="mt-4 md:mt-6 bg-zinc-200 p-1 rounded-full flex items-center border border-zinc-300/60 max-w-md mx-auto">
            <button
              onClick={() => {
                setActiveTab("book");
                setStep(1);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all text-center ${
                activeTab === "book"
                  ? "bg-[#1F1F23] text-white shadow-sm"
                  : "text-zinc-800 hover:text-black"
              }`}
            >
              Reservar Cita
            </button>
            <button
              onClick={() => setActiveTab("my-appointments")}
              className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all text-center flex items-center justify-center gap-1.5 ${
                activeTab === "my-appointments"
                  ? "bg-[#1F1F23] text-white shadow-sm"
                  : "text-zinc-800 hover:text-black"
              }`}
            >
              <span>Mis Citas</span>
              <span
                className={`text-xs px-2 py-0.2 rounded-full font-bold ${
                  activeTab === "my-appointments"
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-800 text-white"
                }`}
              >
                {activeCount}/2
              </span>
            </button>
          </div>
        </header>
      )}

      {/* 2. Banner when Staff Rescheduled an Appointment */}
      {rescheduledByStaff && step !== 5 && (
        <div className="mx-5 mt-2 p-4 rounded-[24px] bg-[#1F1F23] text-white shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
            <div className="text-xs flex-1">
              <div className="font-bold text-sm">
                ¡Tu cita fue reprogramada por el profesional!
              </div>
              <p className="mt-1 text-zinc-300 leading-relaxed">
                El {rescheduledByStaff.staff?.displayName} movió tu turno para el{" "}
                <b>
                  {new Date(rescheduledByStaff.startAt).toLocaleDateString("es-ES", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  a las{" "}
                  {new Date(rescheduledByStaff.startAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </b>
                .
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAcknowledgeMove(rescheduledByStaff.id)}
                  className="bg-white text-zinc-900 font-bold px-3.5 py-2 rounded-full text-xs hover:bg-zinc-100"
                >
                  ✓ Aceptar horario
                </button>
                <button
                  onClick={() => handleCancelAppointment(rescheduledByStaff.id)}
                  className="bg-white/15 hover:bg-white/25 text-white font-semibold px-3.5 py-2 rounded-full text-xs"
                >
                  Cancelar sin cargo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2b. Banner when Staff Cancelled an Appointment or unread notification */}
      {(unreadCancelNotif || cancelledByStaff) && (
        <div className="mx-5 mt-2 mb-2 p-4 rounded-[24px] bg-[#1F1F23] text-white shadow-lg border border-red-500/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              ✕
            </div>
            <div className="text-xs flex-1">
              <div className="font-bold text-sm text-red-300 flex items-center justify-between flex-wrap gap-1">
                <span>
                  {unreadCancelNotif?.title &&
                  unreadCancelNotif.title !== "Tu cita fue cancelada por el profesional"
                    ? unreadCancelNotif.title
                    : targetTimeStr
                    ? `Se canceló tu cita de las ${targetTimeStr}${targetServiceName ? ` (${targetServiceName})` : ""}`
                    : "Tu cita fue cancelada por el profesional"}
                </span>
                {unreadCancelNotifs.length > 1 && (
                  <span className="bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Aviso 1 de {unreadCancelNotifs.length}
                  </span>
                )}
              </div>
              {targetCancelledApt ? (
                <p className="mt-1 text-zinc-200 leading-relaxed">
                  Tu cita de <strong className="text-white font-semibold">{targetServiceName || "servicio"}</strong> con{" "}
                  <strong className="text-white font-semibold">{targetStaffName}</strong> programada para el{" "}
                  <span className="text-red-200 font-semibold">{targetDateStr} a las {targetTimeStr}</span>{" "}
                  tuvo que cancelarse debido a:{" "}
                  <span className="italic text-zinc-300 font-medium">&quot;{targetCancelReason || "No atiendo hoy por descanso/imprevisto"}&quot;</span>.
                  <br />
                  <span className="text-zinc-400 mt-1 block">
                    Por favor elige un nuevo horario para reagendar tu atención cuando desees.
                  </span>
                </p>
              ) : unreadCancelNotif ? (
                <p className="mt-1 text-zinc-200 leading-relaxed">
                  {unreadCancelNotif.message}
                </p>
              ) : null}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    if (unreadCancelNotif) {
                      handleDismissNotification(
                        unreadCancelNotif.id,
                        unreadCancelNotif.appointmentId || undefined
                      );
                    } else if (cancelledByStaff) {
                      handleDismissNotification(
                        cancelledByStaff.id,
                        cancelledByStaff.id
                      );
                    }
                    if (targetCancelledApt?.service) {
                      setSelectedService(targetCancelledApt.service);
                    }
                    if (targetCancelledApt?.staff?.id) {
                      setSelectedStaffId(targetCancelledApt.staff.id);
                    }
                    setActiveTab("book");
                    setStep(targetCancelledApt?.service ? 3 : 1);
                  }}
                  className="bg-white text-zinc-900 font-bold px-3.5 py-1.5 rounded-full text-xs hover:bg-zinc-100 shadow-sm transition-all"
                >
                  📅 Elegir nuevo horario
                </button>
                <button
                  onClick={() => {
                    if (unreadCancelNotif) {
                      handleDismissNotification(
                        unreadCancelNotif.id,
                        unreadCancelNotif.appointmentId || undefined
                      );
                    } else if (cancelledByStaff) {
                      handleDismissNotification(
                        cancelledByStaff.id,
                        cancelledByStaff.id
                      );
                    }
                  }}
                  className="bg-white/15 hover:bg-white/25 text-white font-medium px-3.5 py-1.5 rounded-full text-xs transition-all"
                >
                  ✕ Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER: CUENTA BLOQUEADA POR INASISTENCIAS PREVIAS */}
      {currentUser?.isBlocked && (
        <div className="mx-5 mb-3 p-4 rounded-[24px] bg-red-600 text-white shadow-lg flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-sm">Reservas en línea restringidas</div>
            <p className="mt-0.5 text-white/90">
              Tu cuenta tiene restricciones para nuevas reservas debido a inasistencias previas sin aviso ({currentUser?.noShowCount || 2} faltas acumuladas).
            </p>
            {settings?.phoneWhatsapp && (
              <a
                href={`https://wa.me/${settings.phoneWhatsapp.replace(/\D/g, "")}?text=Hola,%20quisiera%20solicitar%20un%20turno%20y%20coordinar%20mi%20cita.`}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 bg-white text-zinc-900 font-bold px-3.5 py-1.5 rounded-full shadow-sm text-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Contactar por WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* VIEW A: STEP-BY-STEP BOOKING WIZARD */}
      {activeTab === "book" && (
        <div className="flex-1 flex flex-col px-5 md:px-8 pt-2 pb-6">
          {/* Top Back Bar for Steps 2, 3, and 4 */}
          {step >= 2 && step <= 4 && (
            <div className="flex items-center justify-between pt-3 pb-5">
              <button
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="w-11 h-11 rounded-full bg-[#1F1F23] text-white flex items-center justify-center shadow-sm hover:bg-black active:scale-95 transition-all"
                title="Regresar atrás"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  Paso {step} de 4
                </span>
                <h2 className="text-base md:text-lg font-bold text-[#1F1F23]">
                  {step === 2 && "¿Con quién reservas?"}
                  {step === 3 && "Fecha y Horario"}
                  {step === 4 && "Resumen y Confirmar"}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={`h-2 rounded-full transition-all ${
                      n <= step ? "w-6 bg-[#1F1F23]" : "w-2 bg-zinc-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: SELECT SERVICE DIRECTLY */}
          {step === 1 && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 mt-2 md:mb-6">
                <h2 className="text-lg md:text-2xl font-bold text-[#1F1F23]">
                  ¿Qué servicio necesitas hoy?
                </h2>
                <p className="text-xs md:text-sm text-zinc-500 mt-0.5">
                  Selecciona un servicio para ver profesionales y horarios
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4">
                {services.map((svc: any) => (
                  <button
                    key={svc.id}
                    onClick={() => {
                      setSelectedService(svc);
                      setStep(2);
                    }}
                    className="w-full text-left bg-[#27272A] hover:bg-[#1F1F23] text-white rounded-2xl md:rounded-3xl p-3.5 pl-5 pr-3.5 md:p-5 flex items-center justify-between transition-all shadow-sm hover:shadow-md active:scale-[0.99] group border border-transparent hover:border-zinc-700"
                  >
                    <div>
                      <div className="font-bold text-sm md:text-base leading-tight text-white group-hover:text-emerald-300 transition-colors">
                        {svc.name}
                      </div>
                      <div className="text-xs text-zinc-300 mt-1">
                        ⏱️ {svc.durationMin} min
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm md:text-base text-white">
                        {settings?.currencySymbol || "$"}
                        {svc.price.toFixed(2)}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-white text-[#1F1F23] flex items-center justify-center group-hover:bg-emerald-400 group-hover:text-black transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: SELECT STAFF ONLY */}
          {step === 2 && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 md:mb-6 flex items-center justify-between bg-zinc-100 rounded-2xl md:rounded-full px-4 py-2.5 md:px-5 md:py-3 text-xs md:text-sm">
                <span className="font-semibold text-zinc-700 truncate">
                  {selectedService?.name}
                </span>
                <span className="font-bold text-[#1F1F23]">
                  {settings?.currencySymbol || "$"}
                  {selectedService?.price?.toFixed(2)} •{" "}
                  {selectedService?.durationMin} min
                </span>
              </div>

              <p className="text-xs md:text-sm text-zinc-600 mb-3 md:mb-4">
                Elige con quién deseas atenderte o selecciona cualquiera disponible:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* ANY Staff option */}
                <button
                  onClick={() => {
                    setSelectedStaffId("ANY");
                    setStep(3);
                  }}
                  className="w-full text-left bg-[#1F1F23] text-white rounded-2xl md:rounded-full p-3 pr-4 flex items-center justify-between shadow-sm hover:opacity-95 transition-all md:col-span-2 lg:col-span-3 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm md:text-base">
                        Cualquier {settings?.staffLabel || "Profesional"} disponible
                      </div>
                      <div className="text-xs text-zinc-300">
                        Muestra la mayor cantidad de horarios libres
                      </div>
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white text-[#1F1F23] flex items-center justify-center flex-shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Individual Staff cards (Only active staff, excluding paused/vacation accounts) */}
                {(() => {
                  const activeEligibleStaff = staffList.filter((st: any) => {
                    if (st.isActive === false) return false;
                    if (selectedService?.id && st.services && st.services.length > 0) {
                      return st.services.some((s: any) => s.serviceId === selectedService.id);
                    }
                    return true;
                  });

                  if (activeEligibleStaff.length === 0) {
                    return (
                      <div className="py-8 px-4 bg-zinc-50 rounded-2xl text-center text-xs text-zinc-600 border border-zinc-200 md:col-span-2 lg:col-span-3">
                        <p className="font-bold text-zinc-800 text-sm">
                          No hay profesionales disponibles para este servicio
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          El personal asignado se encuentra en periodo de descanso o vacaciones. Por favor elige otro servicio o contáctanos por WhatsApp.
                        </p>
                      </div>
                    );
                  }

                  return activeEligibleStaff.map((st: any) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        setSelectedStaffId(st.id);
                        setStep(3);
                      }}
                      className="w-full text-left bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-[#1F1F23] rounded-2xl md:rounded-full p-2.5 pr-4 flex items-center justify-between shadow-2xs transition-all hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-300 border-2 border-white flex-shrink-0">
                          {st.avatarUrl ? (
                            <img
                              src={st.avatarUrl}
                              alt={st.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-zinc-700">
                              {st.displayName?.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#1F1F23]">{st.displayName}</div>
                          <div className="text-xs text-zinc-600">
                            {st.specialtyTitle}
                          </div>
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-[#1F1F23] text-white flex items-center justify-center flex-shrink-0">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* STEP 3: SELECT DATE & TIME ONLY */}
          {step === 3 && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <span className="bg-zinc-100 text-zinc-800 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                    {selectedService?.name} ({settings?.currencySymbol || "$"}
                    {selectedService?.price})
                  </span>
                  <span className="bg-zinc-100 text-zinc-800 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                    {selectedStaffId === "ANY"
                      ? `Cualquier ${settings?.staffLabel || "Profesional"}`
                      : selectedStaffObj?.displayName}
                  </span>
                </div>

                <div className="md:grid md:grid-cols-12 md:gap-8 items-start">
                  {/* Left Column on Desktop: Days selection */}
                  <div className="md:col-span-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                        Selecciona el día
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const idx = dateOptions.findIndex(
                              (d) => d.dateStr === selectedDateStr
                            );
                            if (idx > 0) setSelectedDateStr(dateOptions[idx - 1].dateStr);
                          }}
                          className="w-7 h-7 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-800 flex items-center justify-center text-xs font-bold"
                          title="Día anterior"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = dateOptions.findIndex(
                              (d) => d.dateStr === selectedDateStr
                            );
                            if (idx < dateOptions.length - 1)
                              setSelectedDateStr(dateOptions[idx + 1].dateStr);
                          }}
                          className="w-7 h-7 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-800 flex items-center justify-center text-xs font-bold"
                          title="Día siguiente"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    {/* Horizontal scroll on mobile, sleek wrap/grid on desktop */}
                    <div className="overflow-x-auto no-scrollbar pill-slider flex md:grid md:grid-cols-3 gap-2.5 py-1 px-1">
                      {dateOptions.map((item) => {
                        const isSelected = selectedDateStr === item.dateStr;
                        return (
                          <button
                            key={item.dateStr}
                            onClick={() => setSelectedDateStr(item.dateStr)}
                            className={`flex-shrink-0 min-w-[84px] md:min-w-0 py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center transition-all ${
                              isSelected
                                ? "bg-[#1F1F23] text-white shadow-md scale-[1.03] ring-2 ring-[#1F1F23]/25 font-bold"
                                : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300 font-semibold"
                            }`}
                          >
                            <span className="text-[10px] font-bold uppercase opacity-85 leading-tight">
                              {item.dayShort}
                            </span>
                            <span className="text-sm font-extrabold mt-0.5">
                              {item.dayNumber}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column on Desktop: Time slots */}
                  <div className="md:col-span-7 mt-5 md:mt-0">
                    <div className="flex items-center justify-between mb-2.5">
                      <div>
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                          <span>Horarios disponibles</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            En vivo
                          </span>
                        </label>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Solo se muestran turnos disponibles. Los horarios ocupados o con imprevistos quedan ocultos.
                        </p>
                      </div>
                      <span className="text-xs text-zinc-600 font-bold bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full">
                        {availableSlots.length} {availableSlots.length === 1 ? "libre" : "libres"}
                      </span>
                    </div>

                    {slotsLoading ? (
                      <div className="py-10 text-center text-xs text-zinc-500 animate-pulse">
                        Buscando horarios libres...
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="py-8 px-4 bg-zinc-50 rounded-2xl text-center text-xs text-zinc-600 border border-zinc-200">
                        {selectedDateStr === formatLocalDateYYYYMMDD(new Date()) ? (
                          <div>
                            <p className="font-bold text-zinc-800 text-sm">No quedan horarios disponibles para hoy.</p>
                            <p className="text-[11px] text-zinc-500 mt-1">
                              El horario de atención ha finalizado o los cupos de hoy están completos. Selecciona mañana u otra fecha en el calendario.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-zinc-800 text-sm">Sin cupos disponibles en esta fecha.</p>
                            <p className="text-[11px] text-zinc-500 mt-1">
                              No hay turnos libres para este día. Por favor elige otra fecha disponible en el calendario.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {availableSlots.map((slot) => {
                          const isSelected = selectedTime === slot;
                          return (
                            <button
                              key={slot}
                              onClick={() => setSelectedTime(slot)}
                              className={`py-3 rounded-xl md:rounded-2xl text-xs font-bold transition-all ${
                                isSelected
                                  ? "bg-[#1F1F23] text-white shadow-md scale-[1.03]"
                                  : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-zinc-100 flex justify-end">
                <button
                  onClick={() => {
                    if (!selectedTime || !availableSlots.includes(selectedTime)) return;
                    setStep(4);
                  }}
                  disabled={!selectedTime || !availableSlots.includes(selectedTime) || availableSlots.length === 0}
                  className="w-full md:w-auto md:min-w-[280px] rounded-full bg-[#1F1F23] text-white h-14 font-semibold text-sm shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Continuar al Resumen</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: FINAL SUMMARY CARD & CONFIRMATION */}
          {step === 4 && (
            <div className="flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-12 md:gap-8 items-start">
                {/* Left Column on Desktop: Summary & Location */}
                <div className="md:col-span-5 space-y-4">
                  {/* Summary Card (High Contrast Dark Charcoal) */}
                  <div className="bg-[#27272A] text-white rounded-[28px] p-5 md:p-6 shadow-md">
                    <div className="flex items-center justify-between text-xs text-zinc-300 font-medium">
                      <span>Total del servicio</span>
                      <span className="bg-white text-[#1F1F23] px-3 py-1 rounded-full text-xs font-bold">
                        {selectedService?.durationMin} min
                      </span>
                    </div>
                    <div className="mt-1 text-3xl md:text-4xl font-bold tracking-tight text-white">
                      {settings?.currencySymbol || "$"}
                      {selectedService?.price?.toFixed(2)}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/15 space-y-2 text-xs md:text-sm text-white">
                      <div className="flex justify-between">
                        <span className="text-zinc-300">Servicio:</span>
                        <span className="font-bold">{selectedService?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-300">
                          {settings?.staffLabel || "Profesional"}:
                        </span>
                        <span className="font-bold">
                          {selectedStaffId === "ANY"
                            ? `Cualquier ${settings?.staffLabel || "Profesional"}`
                            : selectedStaffObj?.displayName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-300">Fecha y Hora:</span>
                        <span className="font-bold">
                          {selectedDateStr} • {selectedTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lugar de la Cita (Píldora limpia y compacta) */}
                  <div className="p-4 bg-zinc-100 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-zinc-900">
                          {settings?.name || "Clínica & Reservas"}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {settings?.addressText || "Av. Simón López esq. Av. Beijing, Cochabamba"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMapModal(true)}
                      className="text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full border border-rose-200 transition-all flex-shrink-0"
                    >
                      Ver mapa
                    </button>
                  </div>
                </div>

                {/* Right Column on Desktop: Contact & Identity Form */}
                <div className="md:col-span-7 space-y-4 mt-2 md:mt-0">
                  {/* Customer Identity Section */}
                  {currentUser ? (
                    <div className="p-3.5 bg-zinc-100 rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        {currentUser?.avatarUrl ? (
                          <img
                            src={currentUser.avatarUrl}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full object-cover border border-zinc-300"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#1F1F23] text-white flex items-center justify-center font-bold text-xs uppercase">
                            {currentUser?.name?.charAt(0) || "U"}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-zinc-900">
                            {currentUser.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {currentUser.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          {currentUser?.googleId ? "Google Verificado ✓" : "Verificado"}
                        </span>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="text-[11px] text-zinc-500 hover:text-black underline"
                        >
                          Salir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-zinc-50 border border-zinc-200 p-4 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800">
                          Identificación del Paciente
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAuthModal(true)}
                          className="text-[11px] font-semibold text-[#1F1F23] underline hover:text-zinc-600"
                        >
                          ¿Tienes cuenta? Ingresa
                        </button>
                      </div>

                      {/* Botón 1-Clic Google OAuth */}
                      <a
                        href="/api/auth/google?returnTo=/"
                        className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold border border-zinc-300 shadow-2xs flex items-center justify-center gap-2 transition-all"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Identificarme con Google (1 Clic)</span>
                      </a>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-zinc-200" />
                        <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                          O completa tus datos
                        </span>
                        <div className="flex-1 h-px bg-zinc-200" />
                      </div>

                      <div className="border border-zinc-300 bg-white rounded-xl px-3.5 py-2">
                        <label className="text-[11px] text-zinc-500 block font-medium">
                          Nombre Completo *
                        </label>
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="Ej. Juan Pérez"
                          className="bg-transparent font-semibold text-xs text-[#1F1F23] focus:outline-none w-full mt-0.5"
                        />
                      </div>

                      <div className="border border-zinc-300 bg-white rounded-xl px-3.5 py-2">
                        <label className="text-[11px] text-zinc-500 block font-medium">
                          Correo Electrónico *
                        </label>
                        <input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder="tucorreo@ejemplo.com"
                          className="bg-transparent font-medium text-xs text-[#1F1F23] focus:outline-none w-full mt-0.5"
                        />
                      </div>

                      <div className="border border-zinc-300 bg-white rounded-xl px-3.5 py-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-zinc-500 block font-medium">
                            Contraseña *
                          </label>
                          <span className="text-[10px] text-zinc-400">Mín. 6 caracteres</span>
                        </div>
                        <input
                          type="password"
                          value={guestPassword}
                          onChange={(e) => setGuestPassword(e.target.value)}
                          placeholder="••••••••"
                          className="bg-transparent font-medium text-xs text-[#1F1F23] focus:outline-none w-full mt-0.5"
                        />
                        <span className="text-[10px] text-zinc-400 block mt-0.5">
                          Protege tu reserva para que nadie más acceda a tus citas.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Phone Input */}
                  <div className="border-[1.5px] border-[#1F1F23] bg-[#F4F4F6] rounded-2xl px-4 py-2.5 flex items-center gap-3">
                    <Phone className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500 block font-medium">
                        Teléfono / WhatsApp (Obligatorio)
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+52 55 1234 5678"
                        className="bg-transparent font-semibold text-sm text-[#1F1F23] focus:outline-none w-full"
                      />
                    </div>
                  </div>

                  {/* Optional Comment */}
                  <div className="border-[1.5px] border-zinc-300 bg-[#F4F4F6] rounded-2xl px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500 block font-medium">
                        Nota o comentario (Opcional)
                      </label>
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="Ej. Motivo de consulta o detalle especial"
                        className="bg-transparent font-medium text-sm text-[#1F1F23] focus:outline-none w-full"
                      />
                    </div>
                  </div>

                  {bookingError && (
                    <div className="p-3.5 rounded-2xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-600" />
                        <span>{bookingError}</span>
                      </div>
                      {(bookingError.includes("no está disponible") ||
                        bookingError.includes("margen") ||
                        bookingError.includes("franja") ||
                        bookingError.includes("ocupado")) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTime("");
                            setBookingError(null);
                            setStep(3);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 hover:bg-red-200 text-red-900 text-[11px] font-bold transition-all cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Volver al Paso 3 y elegir un horario libre disponible</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={handleConfirmBooking}
                      disabled={bookingLoading}
                      className="w-full rounded-full bg-[#1F1F23] hover:bg-black text-white h-14 font-semibold text-sm shadow-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <span>
                        {bookingLoading
                          ? "Confirmando Cita..."
                          : "Confirmar Cita Ahora"}
                      </span>
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: CONFIRMED APPOINTMENT SCREEN (Concentric Circles) */}
          {step === 5 && confirmedAppointment && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <div className="my-4 flex items-center justify-center">
                <div className="w-36 h-36 rounded-full bg-zinc-100 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-[#A8A9AF]/50 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#1F1F23] text-white flex items-center justify-center shadow-lg">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-[#1F1F23]">
                ¡Cita Confirmada!
              </h2>
              <p className="text-xs text-zinc-500 mt-1 max-w-[260px]">
                Tu horario ha quedado reservado exitosamente.
              </p>

              <div className="mt-6 w-full bg-[#F4F4F6] rounded-[24px] p-4 text-left text-xs space-y-2 border border-zinc-200">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Servicio:</span>
                  <span className="font-bold text-zinc-900">
                    {confirmedAppointment.service?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Con:</span>
                  <span className="font-bold text-zinc-900">
                    {confirmedAppointment.staff?.displayName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Cuándo:</span>
                  <span className="font-bold text-zinc-900">
                    {new Date(confirmedAppointment.startAt).toLocaleDateString(
                      "es-ES",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }
                    )}{" "}
                    •{" "}
                    {new Date(confirmedAppointment.startAt).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-6 w-full space-y-2.5">
                <button
                  onClick={() => {
                    setStep(1);
                    setActiveTab("my-appointments");
                  }}
                  className="w-full rounded-full bg-[#1F1F23] text-white h-14 font-semibold text-sm shadow-md hover:bg-black"
                >
                  Ver en Mis Citas
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="w-full rounded-full bg-zinc-100 text-zinc-700 h-12 font-semibold text-xs hover:bg-zinc-200"
                >
                  Volver al Inicio
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW B: MY APPOINTMENTS */}
      {activeTab === "my-appointments" && (
        <div className="px-5 md:px-8 pt-2 pb-8 space-y-5">
          {(() => {
            const activeApts = userAppointments.filter(
              (a: any) =>
                a.status === "CONFIRMED" || a.status === "RESCHEDULED_BY_STAFF"
            );
            const activeNoShowApts = userAppointments.filter(
              (a: any) => a.status === "NO_SHOW"
            );
            const archivedNoShowApts = userAppointments.filter(
              (a: any) => a.status === "NO_SHOW_ARCHIVED"
            );
            const completedApts = userAppointments.filter(
              (a: any) => a.status === "COMPLETED"
            );
            const cancelledApts = userAppointments.filter(
              (a: any) => a.status === "CANCELLED"
            );
            const historyTotal =
              completedApts.length +
              archivedNoShowApts.length +
              cancelledApts.length;

            return (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#1F1F23]">
                    Tus Reservas Activas ({activeApts.length})
                  </h2>
                  <span className="text-xs text-zinc-400">Máx. 2 activas</span>
                </div>

                {!currentUser ? (
                  <div className="py-8 px-4 text-center text-xs bg-zinc-50 rounded-3xl border border-zinc-200 space-y-2">
                    <User className="w-8 h-8 mx-auto text-zinc-400" />
                    <p className="font-semibold text-zinc-800 text-sm">
                      Consulta tus reservas activas
                    </p>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Ingresa tu correo para ver tus citas agendadas y gestionar cancelaciones o reprogramaciones.
                    </p>
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="mt-3 px-5 py-2.5 rounded-full bg-[#1F1F23] text-white text-xs font-semibold hover:bg-black transition-all"
                    >
                      Ingresar con mi Correo
                    </button>
                  </div>
                ) : (
                  <>
                    {activeApts.length === 0 && activeNoShowApts.length === 0 && (
                      <div className="py-8 text-center text-xs text-zinc-400 bg-zinc-50 rounded-3xl border border-zinc-200">
                        <Calendar className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                        <p className="font-semibold text-zinc-700">
                          No tienes citas próximas pendientes
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Tu cuenta está al día (0 faltas activas).
                        </p>
                        <button
                          onClick={() => {
                            setActiveTab("book");
                            setStep(1);
                          }}
                          className="mt-4 px-5 py-2.5 rounded-full bg-[#1F1F23] text-white text-xs font-semibold"
                        >
                          Reservar Ahora
                        </button>
                      </div>
                    )}

                    {activeApts.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeApts.map((apt: any) => {
                      const isPast = new Date(apt.startAt) < new Date();
                      const isRescheduled =
                        apt.status === "RESCHEDULED_BY_STAFF";

                      return (
                        <div
                          key={apt.id}
                          className={`p-4 rounded-[26px] border transition-all ${
                            isRescheduled
                              ? "bg-amber-50 border-amber-300"
                              : "bg-[#F4F4F6] border-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-zinc-900 text-sm">
                              {apt.service?.name}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isRescheduled
                                  ? "bg-amber-500 text-white"
                                  : "bg-[#1F1F23] text-white"
                              }`}
                            >
                              {isRescheduled ? "MODIFICADA" : "CONFIRMADA"}
                            </span>
                          </div>

                          <div className="mt-2.5 text-xs text-zinc-600 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                              <span>
                                {new Date(apt.startAt).toLocaleDateString(
                                  "es-ES",
                                  {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                  }
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="font-semibold text-zinc-900">
                                {new Date(apt.startAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                ({apt.service?.durationMin} min)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-zinc-400" />
                              <span>
                                {settings?.staffLabel || "Profesional"}:{" "}
                                <b>{apt.staff?.displayName}</b>
                              </span>
                            </div>
                          </div>

                          {!isPast && (
                            <div className="mt-3 pt-2.5 border-t border-zinc-200 flex items-center justify-between">
                              {apt.canCancel ? (
                                <button
                                  onClick={() =>
                                    handleCancelAppointment(apt.id)
                                  }
                                  className="text-xs text-red-600 font-bold hover:underline"
                                >
                                  {apt.isFreeCancellationBecauseOfStaff
                                    ? "Cancelar sin penalización"
                                    : "Cancelar cita"}
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">
                                  No cancelable ({settings?.minCancelNoticeHours}
                                  h mín.)
                                </span>
                              )}

                              {settings?.phoneWhatsapp && (
                                <a
                                  href={`https://wa.me/${settings.phoneWhatsapp.replace(
                                    /\D/g,
                                    ""
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold text-[#1F1F23] flex items-center gap-1 hover:underline"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. INASISTENCIAS VIGENTES DEL CICLO ACTUAL */}
                {activeNoShowApts.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                        Inasistencias vigentes (Ciclo actual):
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {activeNoShowApts.length} de 2 permitidas
                      </span>
                    </div>

                    {activeNoShowApts.map((apt: any, idx: number) => (
                      <div
                        key={apt.id}
                        className="p-4 rounded-[26px] bg-amber-50 border border-amber-300 text-xs shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-zinc-900 text-sm">
                            {apt.service?.name}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                            ⚠️ FALTA ACTIVA ({idx + 1}/2)
                          </span>
                        </div>
                        <div className="mt-2 text-zinc-700">
                          📅{" "}
                          {new Date(apt.startAt).toLocaleDateString("es-ES", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          a las{" "}
                          <b>
                            {new Date(apt.startAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </b>{" "}
                          con {apt.staff?.displayName}
                        </div>
                        <p className="text-[11px] text-amber-800 mt-1 font-medium">
                          Esta falta contabiliza para el bloqueo automático. Si
                          fue justificable, contáctanos por WhatsApp para
                          archivarla y reiniciar tu contador.
                        </p>
                        {settings?.phoneWhatsapp && (
                          <div className="mt-3 pt-2 border-t border-amber-200 flex justify-end">
                            <a
                              href={`https://wa.me/${settings.phoneWhatsapp.replace(
                                /\D/g,
                                ""
                              )}?text=Hola,%20tuve%20un%20inconveniente%20justificable%20en%20mi%20cita%20y%20quisiera%20regularizar%20mi%20cuenta.`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Justificar por WhatsApp</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. ACORDEÓN COLAPSABLE DE HISTORIAL PASADO Y ARCHIVO */}
                {historyTotal > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowHistory(!showHistory)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs font-bold text-zinc-700 flex items-center justify-between transition-all"
                    >
                      <span>
                        📂 Historial de citas pasadas y archivo ({historyTotal})
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {showHistory ? "Ocultar ▲" : "Ver historial ▼"}
                      </span>
                    </button>

                    {showHistory && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2.5">
                        {archivedNoShowApts.map((apt: any) => (
                          <div
                            key={apt.id}
                            className="p-3.5 rounded-[22px] bg-zinc-100 border border-zinc-200 text-xs text-zinc-600"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-800">
                                {apt.service?.name}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-300 text-zinc-800">
                                📁 JUSTIFICADA / ARCHIVADA
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
                              ✓ El consultorio reinició tu contador. Esta falta
                              pasada está archivada y no afecta tu cuenta
                              actual.
                            </div>
                          </div>
                        ))}

                        {completedApts.map((apt: any) => (
                          <div
                            key={apt.id}
                            className="p-3.5 rounded-[22px] bg-emerald-50/70 border border-emerald-200 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-900">
                                {apt.service?.name}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700 text-white">
                                ✓ ATENDIDA
                              </span>
                            </div>
                            <div className="mt-1.5 text-[11px] text-zinc-600 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                              <span>
                                {new Date(apt.startAt).toLocaleDateString("es-ES", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}{" "}
                                •{" "}
                                {new Date(apt.startAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {apt.staff?.displayName && (
                                <span>• con {apt.staff.displayName}</span>
                              )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-emerald-200/70 flex justify-end">
                              <button
                                onClick={() => {
                                  setSelectedService(apt.service);
                                  setStep(2);
                                  setActiveTab("book");
                                }}
                                className="px-3 py-1 rounded-full bg-[#1F1F23] text-white font-bold text-[11px] hover:bg-black transition-all"
                              >
                                📅 Repetir servicio
                              </button>
                            </div>
                          </div>
                        ))}

                        {cancelledApts.map((apt: any) => {
                          const isStaffCancelled = Boolean(apt.staffMoveReason);
                          return (
                            <div
                              key={apt.id}
                              className={`p-3.5 rounded-[22px] border text-xs transition-all ${
                                isStaffCancelled
                                  ? "bg-amber-50/60 border-amber-200"
                                  : "bg-zinc-100 border-zinc-200 text-zinc-600"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-zinc-900">
                                  {apt.service?.name}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    isStaffCancelled
                                      ? "bg-amber-200 text-amber-900"
                                      : "bg-zinc-300 text-zinc-700"
                                  }`}
                                >
                                  {isStaffCancelled
                                    ? "✕ CANCELADA POR PROFESIONAL"
                                    : "✕ CANCELADA"}
                                </span>
                              </div>

                              <div className="mt-1.5 text-[11px] text-zinc-600 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                                <span>
                                  {new Date(apt.startAt).toLocaleDateString("es-ES", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  })}{" "}
                                  •{" "}
                                  {new Date(apt.startAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {apt.staff?.displayName && (
                                  <span>• con {apt.staff.displayName}</span>
                                )}
                              </div>

                              {apt.staffMoveReason ? (
                                <div className="mt-2 p-2 rounded-xl bg-white/80 border border-amber-200 text-[11px] text-amber-900">
                                  <b>Motivo indicado por {settings?.staffLabel?.toLowerCase() || "el profesional"}:</b> &quot;{apt.staffMoveReason}&quot;
                                </div>
                              ) : (
                                <div className="mt-1 text-[11px] text-zinc-500 italic">
                                  Cancelada a solicitud del cliente.
                                </div>
                              )}

                              <div className="mt-2.5 pt-2 border-t border-zinc-200/80 flex justify-end">
                                <button
                                  onClick={() => {
                                    if (apt.service) {
                                      setSelectedService(apt.service);
                                      setStep(2);
                                    } else {
                                      setStep(1);
                                    }
                                    setActiveTab("book");
                                  }}
                                  className="px-3 py-1 rounded-full bg-[#1F1F23] text-white font-bold text-[11px] hover:bg-black transition-all flex items-center gap-1.5"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>Volver a agendar</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}
        </div>
      )}

      {/* CANCELLATION POLICY MODAL */}
      {policyModal?.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-6 max-w-sm w-full text-center shadow-2xl">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-zinc-900">
              Política de Cancelación
            </h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              {policyModal.message}
            </p>

            <div className="mt-5 flex gap-2">
              <a
                href={policyModal.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 rounded-full bg-[#1F1F23] text-white text-xs font-semibold hover:bg-black"
              >
                Hablar por WhatsApp
              </a>
              <button
                onClick={() => setPolicyModal(null)}
                className="py-3 px-5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-zinc-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE UBICACIÓN Y MAPA INTERACTIVO */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <MapPin className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1F1F23]">
                    Ubicación de la Sucursal
                  </h3>
                  <p className="text-[11px] text-zinc-500">Cochabamba, Bolivia</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-700 flex items-center justify-center transition-all"
                title="Cerrar mapa"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3">
              <BranchMap
                name={settings?.name || "Clínica & Reservas"}
                addressText={settings?.addressText || "Av. Simón López esq. Av. Beijing, Cochabamba, Bolivia"}
                lat={-17.3713}
                lng={-66.1742}
                googleMapsUrl={settings?.googleMapsUrl}
                height="260px"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSTALACIÓN PWA (INSTALAR COMO APP EN CELULAR / PC) */}
      {showPwaModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#1F1F23] text-white flex items-center justify-center font-bold text-lg shadow-md">
                  📲
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1F1F23]">
                    Instalar como Aplicación (PWA)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Acceso directo sin usar memoria del teléfono
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPwaModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs"
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
                    setDeferredPrompt(null);
                  }
                  setPwaInstalled(true);
                  setShowPwaModal(false);
                }}
                className="w-full py-3.5 rounded-full bg-[#1F1F23] hover:bg-black text-white text-xs font-bold shadow-md transition-all"
              >
                {pwaInstalled
                  ? "✓ Aplicación ya instalada en tu inicio"
                  : "📲 Instalar App Ahora (1-Toque)"}
              </button>
              <button
                type="button"
                onClick={() => setShowPwaModal(false)}
                className="w-full py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Production Footer */}
      <footer className="mt-auto px-5 md:px-8 py-6 md:py-7 text-center border-t border-zinc-200/80 bg-zinc-50/50 text-xs text-zinc-500 space-y-2 md:rounded-b-[32px]">
        <p className="font-semibold text-zinc-700">{settings?.name || "Clínica & Reservas"}</p>
        <p className="text-[11px] text-zinc-400">
          {settings?.addressText || "Atención con cita previa"}
        </p>
        <div className="pt-2">
          <a
            href="/admin"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 underline transition-all"
          >
            <span>Acceso para Profesionales y Administración</span>
            <span>→</span>
          </a>
        </div>
      </footer>

      {/* 6. Account / Login Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-zinc-200">
            <button
              onClick={() => {
                setShowAuthModal(false);
                setAuthError(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center hover:bg-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>

            {currentUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#1F1F23] text-white flex items-center justify-center font-bold text-base uppercase">
                    {currentUser.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900">{currentUser.name}</h3>
                    <p className="text-xs text-zinc-500">{currentUser.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                      {currentUser.role === "ADMIN"
                        ? "Administrador"
                        : currentUser.role === "PROVIDER"
                        ? settings?.staffLabel || "Doctor(a)"
                        : "Cliente"}
                    </span>
                  </div>
                </div>

                {currentUser.phone && (
                  <div className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                    <span className="text-zinc-400 block text-[10px]">Teléfono registrado:</span>
                    <span className="font-semibold">{currentUser.phone}</span>
                  </div>
                )}

                {(currentUser.role === "ADMIN" || currentUser.role === "PROVIDER") && (
                  <a
                    href="/admin"
                    className="w-full py-3 rounded-full bg-[#1F1F23] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-md"
                  >
                    <span>Ir al Panel de Gestión</span>
                    <span>→</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await handleLogout();
                    setShowAuthModal(false);
                  }}
                  className="w-full py-2.5 rounded-full bg-zinc-100 text-red-600 hover:bg-red-50 text-xs font-bold transition-all border border-zinc-200"
                >
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {/* 1-Click Google OAuth */}
                <a
                  href="/api/auth/google?returnTo=/"
                  className="w-full py-3 px-4 rounded-full bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold border border-zinc-300 shadow-xs flex items-center justify-center gap-2.5 transition-all"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continuar con Google (1 Clic)</span>
                </a>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-zinc-200" />
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                    O con correo electrónico
                  </span>
                  <div className="flex-1 h-px bg-zinc-200" />
                </div>

                {/* Auth Mode Toggle Tabs */}
                <div className="bg-zinc-100 p-1 rounded-full flex items-center border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                      authMode === "login"
                        ? "bg-[#1F1F23] text-white shadow-xs"
                        : "text-zinc-600 hover:text-black"
                    }`}
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                      authMode === "register"
                        ? "bg-[#1F1F23] text-white shadow-xs"
                        : "text-zinc-600 hover:text-black"
                    }`}
                  >
                    Crear Cuenta
                  </button>
                </div>

                <div>
                  <h3 className="font-bold text-base text-zinc-900">
                    {authMode === "login" ? "Acceso Seguro a tu Cuenta" : "Registro de Nuevo Cliente"}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {authMode === "login"
                      ? "Ingresa tu correo y contraseña para ver tus citas o gestionar reservas."
                      : "Crea tu cuenta protegida para consultar tu historial médico y citas."}
                  </p>
                </div>

                {authError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    {authError}
                  </div>
                )}

                <div className="space-y-3">
                  {authMode === "register" && (
                    <div className="border border-zinc-300 bg-[#F4F4F6] rounded-xl px-3.5 py-2">
                      <label className="text-[11px] text-zinc-500 block font-medium">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="bg-transparent font-medium text-xs text-[#1F1F23] focus:outline-none w-full mt-0.5"
                      />
                    </div>
                  )}

                  <div className="border border-zinc-300 bg-[#F4F4F6] rounded-xl px-3.5 py-2">
                    <label className="text-[11px] text-zinc-500 block font-medium">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="tucorreo@ejemplo.com"
                      className="bg-transparent font-semibold text-xs text-[#1F1F23] focus:outline-none w-full mt-0.5"
                    />
                  </div>

                  {authMode === "register" && (
                    <div className="border border-zinc-300 bg-[#F4F4F6] rounded-xl px-3.5 py-2">
                      <label className="text-[11px] text-zinc-500 block font-medium">
                        Teléfono / WhatsApp (Opcional)
                      </label>
                      <input
                        type="tel"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        placeholder="+591 70000000"
                        className="bg-transparent font-medium text-xs text-[#1F1F23] focus:outline-none w-full mt-0.5"
                      />
                    </div>
                  )}

                  <div className="border border-zinc-300 bg-[#F4F4F6] rounded-xl px-3.5 py-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-zinc-500 block font-medium">
                        Contraseña *
                      </label>
                      <span className="text-[10px] text-zinc-400">Mín. 6 caracteres</span>
                    </div>
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-transparent font-semibold text-xs text-[#1F1F23] focus:outline-none w-full mt-0.5"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3.5 rounded-full bg-[#1F1F23] text-white text-xs font-bold hover:bg-black transition-all shadow-md disabled:opacity-50"
                  >
                    {authLoading
                      ? "Procesando..."
                      : authMode === "login"
                      ? "Iniciar Sesión"
                      : "Crear Cuenta y Continuar"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthModal(false);
                      setAuthError(null);
                      setAuthPassword("");
                    }}
                    className="w-full py-2.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold hover:bg-zinc-200 transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

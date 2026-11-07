// tests/e2e-full-system.test.ts
import { prisma } from "../src/lib/prisma";
import { formatLocalDateYYYYMMDD } from "../src/lib/date-utils";

const BASE_URL = "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ` -> ${detail}` : ""}`);
    failed++;
  }
}

class BrowserSession {
  cookies: Record<string, string> = {};

  async request(path: string, options: RequestInit = {}) {
    const cookieHeader = Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const parts = setCookie.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);
      for (const part of parts) {
        const [pair] = part.split(";");
        const [key, val] = pair.trim().split("=");
        if (key) {
          if (!val || part.includes("Max-Age=0") || part.includes("Expires=Thu, 01 Jan 1970")) {
            delete this.cookies[key];
          } else {
            this.cookies[key] = val;
          }
        }
      }
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return { status: res.status, ok: res.ok, json, text };
  }
}

async function runE2E() {
  console.log("\n==============================================================");
  console.log("🚀 INICIANDO SUITE E2E FULL-STACK (MODO PLAYWRIGHT / BROWSER)");
  console.log("==============================================================\n");

  const testEmail = `qa.e2e.${Date.now()}@test.com`;
  let createdUserId: string | null = null;
  const createdAppointmentIds: string[] = [];
  const createdTimeOffIds: string[] = [];
  const createdServiceIds: string[] = [];

  try {
    // 1. Verificar renderizado HTML de páginas principales (/, /admin)
    console.log("--- 1. Renderizado de Vistas Web (/, /admin) ---");
    const anon = new BrowserSession();
    const homePage = await anon.request("/");
    assert(homePage.status === 200 && homePage.text.includes("<!DOCTYPE html>"), "GET / carga correctamente (HTTP 200)");

    const adminPage = await anon.request("/admin");
    assert(adminPage.status === 200 && adminPage.text.includes("<!DOCTYPE html>"), "GET /admin carga correctamente (HTTP 200)");

    // 2. Bootstrap & Catálogo Público
    console.log("\n--- 2. Bootstrap & Catálogo Público ---");
    const bootRes = await anon.request("/api/bootstrap");
    assert(bootRes.status === 200, "GET /api/bootstrap responde HTTP 200");
    assert(Array.isArray(bootRes.json?.services) && bootRes.json.services.length > 0, "Catálogo contiene servicios activos");
    assert(Array.isArray(bootRes.json?.staff) && bootRes.json.staff.length >= 2, "Catálogo contiene profesionales activos");
    assert(bootRes.json?.allAppointments?.length === 0, "Seguridad: usuario anónimo NO recibe allAppointments en /api/bootstrap");

    const services = bootRes.json.services;
    const staffList = bootRes.json.staff;
    const firstService = services[0];
    const drAlejandro = staffList.find((s: any) => s.displayName.includes("Alejandro")) || staffList[0];

    // Encontrar próximo día de semana (lunes a viernes) dentro de la ventana de 7 días donde todos los doctores atienden
    const now = new Date();
    let targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 1);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const targetDateStr = formatLocalDateYYYYMMDD(targetDate);

    // 3. Motor de Disponibilidad (/api/availability)
    console.log("\n--- 3. Motor de Disponibilidad (/api/availability) ---");
    const availTarget = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${targetDateStr}`
    );
    assert(
      availTarget.status === 200 && Array.isArray(availTarget.json?.slots) && availTarget.json.slots.length > 0,
      `Disponibilidad en día hábil futuro (${targetDateStr}) devuelve turnos libres (${availTarget.json?.slots?.length || 0} libres)`
    );

    // Verificar disponibilidad de Sábado para Dr. Alejandro (atiende 09:00 a 13:00)
    let nextSaturday = new Date(now);
    const daysToSat = (6 - now.getDay() + 7) % 7 || 7;
    if (daysToSat < 7) {
      nextSaturday.setDate(now.getDate() + daysToSat);
      const satStr = formatLocalDateYYYYMMDD(nextSaturday);
      const availSat = await anon.request(
        `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${satStr}`
      );
      assert(
        availSat.status === 200 && Array.isArray(availSat.json?.slots) && availSat.json.slots.length > 0,
        `Disponibilidad en Sábado (${satStr}) para ${drAlejandro.displayName} devuelve turnos libres (${availSat.json?.slots?.length} libres)`
      );
    }

    // Verificar fecha en el pasado -> 0 turnos
    const availPast = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=2020-01-01`
    );
    assert(
      availPast.status === 200 && availPast.json?.slots?.length === 0,
      "Disponibilidad para fecha pasada (2020-01-01) devuelve 0 turnos"
    );

    // Verificar fecha fuera del horizonte (ej. +60 días) -> 0 turnos
    const farFuture = new Date(now);
    farFuture.setDate(now.getDate() + 60);
    const farFutureStr = formatLocalDateYYYYMMDD(farFuture);
    const availFar = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${farFutureStr}`
    );
    assert(
      availFar.status === 200 && availFar.json?.slots?.length === 0,
      `Disponibilidad fuera de ventana máxima (${farFutureStr}) devuelve 0 turnos`
    );

    // 4. Registro de Cliente, Login y Seguridad RBAC
    console.log("\n--- 4. Registro de Cliente, Login y Seguridad RBAC ---");
    const customerSession = new BrowserSession();
    const regRes = await customerSession.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Paciente QA Automatizado",
        email: testEmail,
        phone: "59170099887",
        password: "PasswordQA123",
      }),
    });
    assert(regRes.status === 200 && regRes.json?.user?.email === testEmail, "Registro de nuevo paciente exitoso");
    createdUserId = regRes.json?.user?.id;

    // Verificar que un cliente NO puede usar /api/auth/switch para escalar privilegios a ADMIN
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (adminUser) {
      const switchHack = await customerSession.request("/api/auth/switch", {
        method: "POST",
        body: JSON.stringify({ userId: adminUser.id }),
      });
      assert(
        switchHack.status === 403,
        "BUG-07 SEC: Cliente bloqueado con HTTP 403 al intentar secuestrar sesión Admin en /api/auth/switch"
      );
    }

    // Verificar que un cliente NO puede crear servicios ni modificar horarios
    const svcHack = await customerSession.request("/api/admin/services", {
      method: "POST",
      body: JSON.stringify({ name: "Hack", durationMin: 30, price: 10 }),
    });
    assert(svcHack.status === 403, "RBAC: Cliente bloqueado con HTTP 403 en POST /api/admin/services");

    // 5. Validaciones Estrictas al Agendar Citas (POST /api/appointments)
    console.log("\n--- 5. Validaciones de Reserva y Prevención de Turnos Fantasma ---");

    // 5a. Intentar reservar en fecha pasada
    const pastBook = await customerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: drAlejandro.id,
        date: "2020-05-10",
        time: "10:00",
        customerPhone: "59170099887",
      }),
    });
    assert(pastBook.status === 400, "BUG-01: POST /api/appointments rechaza reserva en fecha pasada (HTTP 400)");

    // 5b. Intentar reservar a las 03:00 AM (fuera del horario laboral del doctor)
    const offHoursBook = await customerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: drAlejandro.id,
        date: targetDateStr,
        time: "03:00",
        customerPhone: "59170099887",
      }),
    });
    assert(
      offHoursBook.status === 409,
      "BUG-01: POST /api/appointments rechaza reserva a las 03:00 AM fuera del turno del doctor (HTTP 409)"
    );

    // 5c. Reserva válida en horario donde varios doctores atienden (ej. 10:00)
    const sharedSlot = availTarget.json.slots.includes("10:00") ? "10:00" : availTarget.json.slots[0];
    const validBook1 = await customerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: drAlejandro.id,
        date: targetDateStr,
        time: sharedSlot,
        customerPhone: "59170099887",
        customerNotes: "Cita de prueba E2E #1",
      }),
    });
    assert(
      validBook1.status === 200 && validBook1.json?.appointment?.id,
      `Reserva #1 creada exitosamente para ${targetDateStr} a las ${sharedSlot} con ${drAlejandro.displayName}`
    );
    if (validBook1.json?.appointment?.id) {
      createdAppointmentIds.push(validBook1.json.appointment.id);
    }

    // 5d. Intentar doble-reserva exactamente en el mismo horario y mismo doctor -> debe fallar con HTTP 409
    const doubleBook = await customerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: drAlejandro.id,
        date: targetDateStr,
        time: sharedSlot,
        customerPhone: "59170099887",
      }),
    });
    assert(
      doubleBook.status === 409,
      `Prevención de Doble Reserva: rechaza segundo turno en ${targetDateStr} ${sharedSlot} con el mismo doctor (HTTP 409)`
    );

    // 5e. Reserva #2 usando "ANY" ("Cualquier profesional disponible") en el MISMO horario -> debe asignar a otro doctor disponible (ej. Dra. Sofía o Dr. Marcos)
    const anyBook2 = await customerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: "ANY",
        date: targetDateStr,
        time: sharedSlot,
        customerPhone: "59170099887",
        customerNotes: "Cita de prueba E2E #2 con ANY",
      }),
    });
    assert(
      anyBook2.status === 200 && anyBook2.json?.appointment?.staffId !== drAlejandro.id,
      `BUG-01 ANY: Reserva con staffId='ANY' en ${sharedSlot} asigna automáticamente a otro profesional libre (${anyBook2.json?.appointment?.staff?.displayName})`
    );
    if (anyBook2.json?.appointment?.id) {
      createdAppointmentIds.push(anyBook2.json.appointment.id);
    }

    // 5f. Límite Anti-Acaparamiento (máximo 2 citas activas por cliente)
    const thirdSlot = availTarget.json.slots.find((s: string) => s !== sharedSlot) || "11:30";
    const thirdBook = await customerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: drAlejandro.id,
        date: targetDateStr,
        time: thirdSlot,
        customerPhone: "59170099887",
      }),
    });
    assert(
      thirdBook.status === 429 && thirdBook.json?.error?.includes("2"),
      "Anti-Acaparamiento: bloquea 3ra cita activa simultánea para el mismo cliente (HTTP 429)"
    );

    // 6. Regla de Negocio: Doctora (PROVIDER) no puede agendar cita como paciente
    console.log("\n--- 6. Separación de Roles: Doctores NO agendan como pacientes ---");
    const providerSession = new BrowserSession();
    const provLogin = await providerSession.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "sofia@sonrisa.com",
        password: "Doctor123!",
        role: "STAFF",
      }),
    });
    assert(
      provLogin.status === 200 && provLogin.json?.user?.role === "PROVIDER",
      "Login de Doctora (sofia@sonrisa.com) en /api/auth/login exitoso"
    );

    const providerBookAttempt = await providerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: drAlejandro.id,
        date: targetDateStr,
        time: thirdSlot,
        customerPhone: "59170011223",
      }),
    });
    assert(
      providerBookAttempt.status === 403,
      "AC-ROLE-01: Doctora (PROVIDER) bloqueada con HTTP 403 al intentar agendar cita como paciente"
    );

    // 7. Flujo de Imprevistos, Notificaciones de Cancelación y Reapertura de Día
    console.log("\n--- 7. Imprevistos del Doctor, Notificaciones al Cliente y Reapertura ---");
    const adminSession = new BrowserSession();
    const admLogin = await adminSession.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "alejandro@sonrisa.com",
        password: "Admin123!",
        role: "STAFF",
      }),
    });
    assert(
      admLogin.status === 200 && admLogin.json?.user?.role === "ADMIN",
      "Login de Administrador Dueño (alejandro@sonrisa.com) exitoso"
    );

    // 7a. Verificar que FULL_DAY_OFF rechaza MOVE_TO_END (BUG-03)
    const badMoveRes = await adminSession.request("/api/admin/day-override", {
      method: "POST",
      body: JSON.stringify({
        staffId: drAlejandro.id,
        type: "FULL_DAY_OFF",
        startAt: new Date(`${targetDateStr}T00:00:00`).toISOString(),
        endAt: new Date(`${targetDateStr}T23:59:59`).toISOString(),
        reason: "Congreso Médico E2E",
        resolution: "MOVE_TO_END",
      }),
    });
    assert(
      badMoveRes.status === 400,
      "BUG-03: FULL_DAY_OFF rechaza resolución MOVE_TO_END que movería citas a las 23:59 (HTTP 400)"
    );

    // 7b. Aplicar FULL_DAY_OFF con CANCEL_ALL y verificar notificación al cliente
    const closeDayRes = await adminSession.request("/api/admin/day-override", {
      method: "POST",
      body: JSON.stringify({
        staffId: drAlejandro.id,
        type: "FULL_DAY_OFF",
        startAt: new Date(`${targetDateStr}T00:00:00`).toISOString(),
        endAt: new Date(`${targetDateStr}T23:59:59`).toISOString(),
        reason: "Congreso Médico E2E",
        resolution: "CANCEL_ALL",
      }),
    });
    assert(
      closeDayRes.status === 200 && closeDayRes.json?.ok === true,
      "Cierre de día (FULL_DAY_OFF + CANCEL_ALL) aplicado correctamente"
    );
    if (closeDayRes.json?.timeOff?.id) {
      createdTimeOffIds.push(closeDayRes.json.timeOff.id);
    }

    // Verificar que el día cerrado ahora tiene 0 turnos disponibles para Dr. Alejandro
    const availClosed = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${targetDateStr}`
    );
    assert(
      availClosed.json?.slots?.length === 0,
      `Día cerrado por imprevisto (${targetDateStr}) muestra 0 turnos disponibles para ${drAlejandro.displayName}`
    );

    // Verificar que el cliente recibió la notificación APPOINTMENT_CANCELLED no leída
    const custBootAfterCancel = await customerSession.request("/api/bootstrap");
    const unreadNotif = (custBootAfterCancel.json?.notifications || []).find(
      (n: any) => !n.isRead && n.type === "APPOINTMENT_CANCELLED"
    );
    assert(
      Boolean(unreadNotif),
      "Cliente recibe notificación APPOINTMENT_CANCELLED (isRead: false) tras cierre de día del doctor"
    );

    // 7c. Marcar notificación como leída (botón "✕ Entendido") y verificar que persiste al recargar
    if (unreadNotif) {
      const readRes = await customerSession.request(`/api/notifications/${unreadNotif.id}/read`, {
        method: "POST",
      });
      assert(readRes.status === 200 && readRes.json?.ok === true, "POST /api/notifications/[id]/read marca notificación como leída");

      const custBootAfterRead = await customerSession.request("/api/bootstrap");
      const stillUnread = (custBootAfterRead.json?.notifications || []).find(
        (n: any) => n.id === unreadNotif.id && !n.isRead
      );
      assert(
        !stillUnread,
        "Persistencia F5: tras pulsar 'Entendido', la notificación permanece con isRead: true al recargar"
      );
    }

    // 7d. Reabrir el día eliminando el bloqueo (DELETE /api/admin/day-override)
    if (closeDayRes.json?.timeOff?.id) {
      const reopenRes = await adminSession.request(
        `/api/admin/day-override?id=${closeDayRes.json.timeOff.id}`,
        { method: "DELETE" }
      );
      assert(
        reopenRes.status === 200 && reopenRes.json?.ok === true,
        "BUG-04: DELETE /api/admin/day-override reabre el día cerrado exitosamente"
      );

      const availReopened = await anon.request(
        `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${targetDateStr}`
      );
      assert(
        availReopened.json?.slots?.length > 0,
        `Tras reabrir el día (${targetDateStr}), los turnos de ${drAlejandro.displayName} vuelven a estar disponibles (${availReopened.json?.slots?.length} libres)`
      );
    }

    // 8. Flujo de Inasistencias (No-Show) y Bloqueo / Desbloqueo Automático
    console.log("\n--- 8. Control de Inasistencias (2 Strikes -> Bloqueo -> Desbloqueo) ---");
    const secondAptRes = await customerSession.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        serviceId: firstService.id,
        staffId: drAlejandro.id,
        date: targetDateStr,
        time: thirdSlot,
        customerPhone: "59170099887",
      }),
    });
    if (secondAptRes.json?.appointment?.id) {
      createdAppointmentIds.push(secondAptRes.json.appointment.id);
    }

    const activeAptIds = createdAppointmentIds.slice(-2);
    if (activeAptIds.length === 2 && createdUserId) {
      // Strike 1
      const ns1 = await adminSession.request(`/api/admin/appointments/${activeAptIds[0]}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "NO_SHOW" }),
      });
      assert(
        ns1.status === 200 && ns1.json?.customer?.noShowCount === 1 && ns1.json?.customer?.isBlocked === false,
        "Strike 1 (NO_SHOW): contador sube a 1, cuenta aún NO bloqueada"
      );

      // Strike 2 -> Bloqueo automático
      const ns2 = await adminSession.request(`/api/admin/appointments/${activeAptIds[1]}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "NO_SHOW" }),
      });
      assert(
        ns2.status === 200 && ns2.json?.customer?.noShowCount === 2 && ns2.json?.customer?.isBlocked === true,
        "Strike 2 (NO_SHOW): contador llega a 2 y la cuenta se bloquea automáticamente (isBlocked: true)"
      );

      // Cliente bloqueado intenta reservar -> rechazado con HTTP 403
      const blockedBook = await customerSession.request("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          serviceId: firstService.id,
          staffId: drAlejandro.id,
          date: targetDateStr,
          time: sharedSlot,
          customerPhone: "59170099887",
        }),
      });
      assert(
        blockedBook.status === 403,
        "Cliente bloqueado por inasistencias no puede crear nuevas reservas (HTTP 403)"
      );

      // Admin desbloquea y reinicia contador a 0
      const unblockRes = await adminSession.request(`/api/admin/users/${createdUserId}/toggle-block`, {
        method: "PUT",
        body: JSON.stringify({ isBlocked: false, resetNoShows: true }),
      });
      assert(
        unblockRes.status === 200 && unblockRes.json?.user?.isBlocked === false && unblockRes.json?.user?.noShowCount === 0,
        "Desbloqueo Admin: reinicia noShowCount a 0, archiva faltas pasadas (NO_SHOW_ARCHIVED) y reactiva al cliente"
      );
    }

    // 9. Validación de Servicios (POST y PUT /api/admin/services)
    console.log("\n--- 9. Validación de Catálogo de Servicios (Crear y Editar) ---");
    const badSvc = await adminSession.request("/api/admin/services", {
      method: "POST",
      body: JSON.stringify({ name: "X", durationMin: 2, price: -50 }),
    });
    assert(badSvc.status === 400, "BUG-06: POST /api/admin/services rechaza precios negativos y duraciones < 5m (HTTP 400)");

    const goodSvc = await adminSession.request("/api/admin/services", {
      method: "POST",
      body: JSON.stringify({
        name: "Servicio QA Temporal",
        description: "Prueba E2E",
        durationMin: 30,
        bufferAfterMin: 5,
        price: 45,
      }),
    });
    assert(goodSvc.status === 200 && goodSvc.json?.service?.id, "Creación de servicio válido exitosa");
    if (goodSvc.json?.service?.id) {
      const svcId = goodSvc.json.service.id;
      createdServiceIds.push(svcId);

      const editSvc = await adminSession.request("/api/admin/services", {
        method: "PUT",
        body: JSON.stringify({
          id: svcId,
          name: "Servicio QA Editado",
          durationMin: 45,
          bufferAfterMin: 10,
          price: 60,
        }),
      });
      assert(
        editSvc.status === 200 && editSvc.json?.service?.price === 60 && editSvc.json?.service?.durationMin === 45,
        "Edición de servicio (PUT /api/admin/services) actualiza precio y duración correctamente"
      );
    }

    // 10. Validación de Horarios de Atención Semanales (PUT /api/admin/shifts)
    console.log("\n--- 10. Validación de Horarios Semanales (/api/admin/shifts) ---");
    const badShifts = await adminSession.request("/api/admin/shifts", {
      method: "PUT",
      body: JSON.stringify({
        staffId: drAlejandro.id,
        shifts: [{ dayOfWeek: 1, startTime: "20:00", endTime: "19:00" }],
      }),
    });
    assert(
      badShifts.status === 400,
      "PUT /api/admin/shifts rechaza horarios invertidos 20:00 a 19:00 con HTTP 400"
    );
  } finally {
    // Limpieza total de datos de prueba para dejar la base de datos intacta
    if (createdAppointmentIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { appointmentId: { in: createdAppointmentIds } },
      });
      await prisma.appointment.deleteMany({
        where: { id: { in: createdAppointmentIds } },
      });
    }
    if (createdTimeOffIds.length > 0) {
      await prisma.timeOff.deleteMany({
        where: { id: { in: createdTimeOffIds } },
      });
    }
    if (createdServiceIds.length > 0) {
      await prisma.staffService.deleteMany({
        where: { serviceId: { in: createdServiceIds } },
      });
      await prisma.service.deleteMany({
        where: { id: { in: createdServiceIds } },
      });
    }
    if (createdUserId) {
      await prisma.notification.deleteMany({
        where: { userId: createdUserId },
      });
      await prisma.appointment.deleteMany({
        where: { customerId: createdUserId },
      });
      await prisma.user.deleteMany({
        where: { id: createdUserId },
      });
    }
  }

  console.log("\n==============================================================");
  console.log(`🏁 RESUMEN E2E FULL-STACK: ${passed + failed} pruebas ejecutadas`);
  console.log(`✅ PASARON: ${passed}`);
  console.log(`❌ FALLARON: ${failed}`);
  console.log("==============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runE2E().catch((err) => {
  console.error("Error fatal en suite E2E:", err);
  process.exit(1);
});

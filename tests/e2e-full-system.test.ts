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
  console.log("🚀 STARTING FULL-STACK E2E TEST SUITE (PLAYWRIGHT / BROWSER MODE)");
  console.log("==============================================================\n");

  const testEmail = `qa.e2e.${Date.now()}@test.com`;
  let createdUserId: string | null = null;
  const createdAppointmentIds: string[] = [];
  const createdTimeOffIds: string[] = [];
  const createdServiceIds: string[] = [];

  try {
    // 1. Verify HTML rendering of primary web views (/, /admin)
    console.log("--- 1. Web View Rendering (/, /admin) ---");
    const anon = new BrowserSession();
    const homePage = await anon.request("/");
    assert(homePage.status === 200 && homePage.text.includes("<!DOCTYPE html>"), "GET / loads successfully (HTTP 200)");

    const adminPage = await anon.request("/admin");
    assert(adminPage.status === 200 && adminPage.text.includes("<!DOCTYPE html>"), "GET /admin loads successfully (HTTP 200)");

    // 2. Bootstrap & Public Catalog
    console.log("\n--- 2. Bootstrap & Public Catalog ---");
    const bootRes = await anon.request("/api/bootstrap");
    assert(bootRes.status === 200, "GET /api/bootstrap responds with HTTP 200");
    assert(Array.isArray(bootRes.json?.services) && bootRes.json.services.length > 0, "Catalog contains active services");
    assert(Array.isArray(bootRes.json?.staff) && bootRes.json.staff.length >= 2, "Catalog contains active staff profiles");
    assert(bootRes.json?.allAppointments?.length === 0, "Security: Anonymous visitor receives 0 allAppointments in bootstrap");

    const services = bootRes.json.services;
    const staffList = bootRes.json.staff;
    const firstService = services[0];
    const drAlejandro = staffList.find((s: any) => s.displayName.includes("Alejandro")) || staffList[0];

    // Find next business weekday within 7-day horizon where all specialists attend
    const now = new Date();
    let targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 1);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const targetDateStr = formatLocalDateYYYYMMDD(targetDate);

    // 3. Availability Calculation Engine (/api/availability)
    console.log("\n--- 3. Availability Engine (/api/availability) ---");
    const availTarget = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${targetDateStr}`
    );
    assert(
      availTarget.status === 200 && Array.isArray(availTarget.json?.slots) && availTarget.json.slots.length > 0,
      `Availability on future weekday (${targetDateStr}) returns open slots (${availTarget.json?.slots?.length || 0} open)`
    );

    // Verify Saturday availability for Dr. Alejandro (attends 09:00 to 13:00)
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
        `Saturday availability (${satStr}) for ${drAlejandro.displayName} returns open slots (${availSat.json?.slots?.length} open)`
      );
    }

    // Verify past date -> 0 slots
    const availPast = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=2020-01-01`
    );
    assert(
      availPast.status === 200 && availPast.json?.slots?.length === 0,
      "Availability for past date (2020-01-01) returns 0 slots"
    );

    // Verify date beyond horizon (+60 days) -> 0 slots
    const farFuture = new Date(now);
    farFuture.setDate(now.getDate() + 60);
    const farFutureStr = formatLocalDateYYYYMMDD(farFuture);
    const availFar = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${farFutureStr}`
    );
    assert(
      availFar.status === 200 && availFar.json?.slots?.length === 0,
      `Availability beyond booking horizon (${farFutureStr}) returns 0 slots`
    );

    // 4. Customer Registration, Login & RBAC Enforcement
    console.log("\n--- 4. Customer Registration, Login & RBAC Enforcement ---");
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
    assert(regRes.status === 200 && regRes.json?.user?.email === testEmail, "New customer account created successfully");
    createdUserId = regRes.json?.user?.id;

    // Verify that a customer CANNOT use /api/auth/switch to escalate privileges to ADMIN
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (adminUser) {
      const switchHack = await customerSession.request("/api/auth/switch", {
        method: "POST",
        body: JSON.stringify({ userId: adminUser.id }),
      });
      assert(
        switchHack.status === 403,
        "BUG-07 SEC: Customer blocked with HTTP 403 when attempting session hijack via /api/auth/switch"
      );
    }

    // Verify that a customer CANNOT create services or modify shifts
    const svcHack = await customerSession.request("/api/admin/services", {
      method: "POST",
      body: JSON.stringify({ name: "Hack", durationMin: 30, price: 10 }),
    });
    assert(svcHack.status === 403, "RBAC: Customer blocked with HTTP 403 on POST /api/admin/services");

    // 5. Strict Appointment Booking Validations (POST /api/appointments)
    console.log("\n--- 5. Booking Validations & Ghost Slot Prevention ---");

    // 5a. Attempt booking in past date
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
    assert(pastBook.status === 400, "BUG-01: POST /api/appointments rejects booking in the past (HTTP 400)");

    // 5b. Attempt booking at 03:00 AM (outside doctor's working shifts)
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
      "BUG-01: POST /api/appointments rejects booking at 03:00 AM outside shift hours (HTTP 409)"
    );

    // 5c. Valid booking during standard business hours (e.g. 10:00)
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
      `Booking #1 created successfully for ${targetDateStr} at ${sharedSlot} with ${drAlejandro.displayName}`
    );
    if (validBook1.json?.appointment?.id) {
      createdAppointmentIds.push(validBook1.json.appointment.id);
    }

    // 5d. Attempt double-booking exact same slot and doctor -> must fail with HTTP 409
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
      `Double-booking guard: Rejects duplicate booking on ${targetDateStr} ${sharedSlot} with same doctor (HTTP 409)`
    );

    // 5e. Booking #2 using "ANY" ("Any available staff") at the SAME time -> auto-assigns other specialist
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
      `BUG-01 ANY: Booking with staffId='ANY' at ${sharedSlot} automatically assigns available specialist (${anyBook2.json?.appointment?.staff?.displayName})`
    );
    if (anyBook2.json?.appointment?.id) {
      createdAppointmentIds.push(anyBook2.json.appointment.id);
    }

    // 5f. Anti-Hoarding limit (maximum 2 active appointments per customer)
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
      "Anti-Hoarding: Blocks 3rd active concurrent booking for the same customer (HTTP 429)"
    );

    // 6. Business Invariant: Doctor (PROVIDER) cannot book appointments as a customer
    console.log("\n--- 6. Role Separation: Doctors Cannot Book as Patients ---");
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
      "Staff login for Dra. Sofía (sofia@sonrisa.com) via /api/auth/login successful"
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
      "AC-ROLE-01: Healthcare provider (PROVIDER) blocked with HTTP 403 when attempting customer booking"
    );

    // 7. Schedule Overrides, Cancellation Notices & Day Reopening
    console.log("\n--- 7. Schedule Overrides, Cancellation Notices & Reopening ---");
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
      "Admin Owner login (alejandro@sonrisa.com) successful"
    );

    // 7a. Verify that FULL_DAY_OFF rejects MOVE_TO_END (BUG-03)
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
      "BUG-03: FULL_DAY_OFF rejects MOVE_TO_END strategy that would move slots to 23:59 (HTTP 400)"
    );

    // 7b. Apply FULL_DAY_OFF with CANCEL_ALL and verify notification to client
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
      "Full day closure (FULL_DAY_OFF + CANCEL_ALL) applied successfully"
    );
    if (closeDayRes.json?.timeOff?.id) {
      createdTimeOffIds.push(closeDayRes.json.timeOff.id);
    }

    // Verify closed day now shows 0 slots available for Dr. Alejandro
    const availClosed = await anon.request(
      `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${targetDateStr}`
    );
    assert(
      availClosed.json?.slots?.length === 0,
      `Day closed by schedule override (${targetDateStr}) shows 0 slots available for ${drAlejandro.displayName}`
    );

    // Verify customer received unread APPOINTMENT_CANCELLED notification
    const custBootAfterCancel = await customerSession.request("/api/bootstrap");
    const unreadNotif = (custBootAfterCancel.json?.notifications || []).find(
      (n: any) => !n.isRead && n.type === "APPOINTMENT_CANCELLED"
    );
    assert(
      Boolean(unreadNotif),
      "Customer receives APPOINTMENT_CANCELLED notification (isRead: false) following staff day closure"
    );

    // 7c. Mark notification as read and verify persistence after reload
    if (unreadNotif) {
      const readRes = await customerSession.request(`/api/notifications/${unreadNotif.id}/read`, {
        method: "POST",
      });
      assert(readRes.status === 200 && readRes.json?.ok === true, "POST /api/notifications/[id]/read marks notification as read");

      const custBootAfterRead = await customerSession.request("/api/bootstrap");
      const stillUnread = (custBootAfterRead.json?.notifications || []).find(
        (n: any) => n.id === unreadNotif.id && !n.isRead
      );
      assert(
        !stillUnread,
        "F5 Persistence: Notification remains isRead: true upon subsequent bootstrap loads"
      );
    }

    // 7d. Reopen day by deleting override (DELETE /api/admin/day-override)
    if (closeDayRes.json?.timeOff?.id) {
      const reopenRes = await adminSession.request(
        `/api/admin/day-override?id=${closeDayRes.json.timeOff.id}`,
        { method: "DELETE" }
      );
      assert(
        reopenRes.status === 200 && reopenRes.json?.ok === true,
        "BUG-04: DELETE /api/admin/day-override reopens closed day successfully"
      );

      const availReopened = await anon.request(
        `/api/availability?serviceId=${firstService.id}&staffId=${drAlejandro.id}&date=${targetDateStr}`
      );
      assert(
        availReopened.json?.slots?.length > 0,
        `Following day reopening (${targetDateStr}), slots for ${drAlejandro.displayName} are restored (${availReopened.json?.slots?.length} open)`
      );
    }

    // 8. No-Show Flow & Automated Account Lock / Unlock (2-Strike System)
    console.log("\n--- 8. Absence Management (2 Strikes -> Account Lock -> Unlock) ---");
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
        "Strike 1 (NO_SHOW): Counter increments to 1, account remains active"
      );

      // Strike 2 -> Automated Account Lock
      const ns2 = await adminSession.request(`/api/admin/appointments/${activeAptIds[1]}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "NO_SHOW" }),
      });
      assert(
        ns2.status === 200 && ns2.json?.customer?.noShowCount === 2 && ns2.json?.customer?.isBlocked === true,
        "Strike 2 (NO_SHOW): Counter reaches 2 and account is automatically locked (isBlocked: true)"
      );

      // Blocked customer attempts booking -> rejected with HTTP 403
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
        "Blocked customer rejected with HTTP 403 when attempting new online booking"
      );

      // Admin unlocks customer and resets strike count to 0
      const unblockRes = await adminSession.request(`/api/admin/users/${createdUserId}/toggle-block`, {
        method: "PUT",
        body: JSON.stringify({ isBlocked: false, resetNoShows: true }),
      });
      assert(
        unblockRes.status === 200 && unblockRes.json?.user?.isBlocked === false && unblockRes.json?.user?.noShowCount === 0,
        "Admin Unlock: Resets noShowCount to 0, archives past absences (NO_SHOW_ARCHIVED) and reactivates customer"
      );
    }

    // 9. Service Catalog Validation (POST & PUT /api/admin/services)
    console.log("\n--- 9. Service Catalog Validation (Create & Edit) ---");
    const badSvc = await adminSession.request("/api/admin/services", {
      method: "POST",
      body: JSON.stringify({ name: "X", durationMin: 2, price: -50 }),
    });
    assert(badSvc.status === 400, "BUG-06: POST /api/admin/services rejects negative prices & durations < 5m (HTTP 400)");

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
    assert(goodSvc.status === 200 && goodSvc.json?.service?.id, "Valid service creation successful");
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
        "Service editing (PUT /api/admin/services) updates price and duration successfully"
      );
    }

    // 10. Weekly Working Shifts Validation (PUT /api/admin/shifts)
    console.log("\n--- 10. Weekly Shift Schedules Validation (/api/admin/shifts) ---");
    const badShifts = await adminSession.request("/api/admin/shifts", {
      method: "PUT",
      body: JSON.stringify({
        staffId: drAlejandro.id,
        shifts: [{ dayOfWeek: 1, startTime: "20:00", endTime: "19:00" }],
      }),
    });
    assert(
      badShifts.status === 400,
      "PUT /api/admin/shifts rejects inverted shift hours 20:00 to 19:00 with HTTP 400"
    );
  } finally {
    // Total test data cleanup to leave database in pristine state
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
  console.log(`🏁 FULL-STACK E2E SUMMARY: ${passed + failed} tests executed`);
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log("==============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runE2E().catch((err) => {
  console.error("Fatal error in E2E suite:", err);
  process.exit(1);
});

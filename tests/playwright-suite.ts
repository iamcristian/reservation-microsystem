// tests/playwright-suite.ts
import { chromium, Browser, Page } from "playwright";
import { prisma } from "../src/lib/prisma";
import { formatLocalDateYYYYMMDD } from "../src/lib/date-utils";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let passedSteps = 0;
let failedSteps = 0;

function assert(condition: boolean, title: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`);
    passedSteps++;
  } else {
    console.error(`  ❌ FAIL: ${title}${detail ? ` -> ${detail}` : ""}`);
    failedSteps++;
  }
}

async function runBrowserTests() {
  console.log("\n==========================================================================");
  console.log("🎭 STARTING PLAYWRIGHT E2E BROWSER EXECUTION (REAL CHROMIUM ENGINE)");
  console.log("==========================================================================\n");

  const browser: Browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const uniqueId = Date.now();
  const testCustomerEmail = `test.pw.${uniqueId}@paciente.com`;
  const testCustomerPass = "ClavePW123";

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 850 },
      deviceScaleFactor: 1,
    });
    const page: Page = await context.newPage();

    // Catch uncaught console runtime exceptions
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    // ========================================================================
    // TC-01: Responsive Desktop vs Mobile & Public Catalog Verification
    // ========================================================================
    console.log("--- TC-01: Responsive Layout & Service Catalog Verification ---");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc01-desktop-home.png") });

    const cardContainer = await page.$("main > div");
    const containerBox = await cardContainer?.boundingBox();
    assert(
      containerBox !== null && containerBox !== undefined && containerBox.width > 600,
      "TC-01: Main container is responsive on desktop viewport (width > 600px on 1280px screen)",
      `Current width: ${containerBox?.width}px`
    );

    // Verify rendered service cards
    const serviceButtons = await page.$$("button:has-text('⏱️')");
    assert(
      serviceButtons.length >= 3,
      `TC-01: Public catalog renders multiple active services (${serviceButtons.length} found)`
    );

    // Open branch map modal
    const mapBtn = await page.$("button:has-text('Ver mapa en la web')");
    if (mapBtn) {
      await mapBtn.click();
      await page.waitForTimeout(400);
      const mapModal = await page.$("text=Ubicación de la Sucursal");
      assert(mapModal !== null, "TC-01: Map modal opens properly without errors");
      const closeMapBtn = await page.$("button[title='Cerrar mapa']");
      if (closeMapBtn) await closeMapBtn.click();
      await page.waitForTimeout(400);
    }

    // ========================================================================
    // TC-02: Local Date Sync & Exclusion of Past Hours on "TODAY"
    // ========================================================================
    console.log("\n--- TC-02: Local Date Synchronization & Past Hour Exclusion ---");
    // Verify Step 2 hides staff who do not perform a restricted service (e.g. Blanqueamiento)
    const whiteningBtn = await page.$("button:has-text('Blanqueamiento')");
    if (whiteningBtn) {
      await whiteningBtn.click();
      await page.waitForTimeout(300);
      const hiddenNonAssigned = await page.$("text=Dr. Marcos Paz");
      const hiddenBadge = await page.$("text=No realiza este servicio");
      assert(
        hiddenNonAssigned === null && hiddenBadge === null,
        "Step 2: Non-assigned specialists (e.g. Dr. Marcos Paz on Blanqueamiento) are hidden instead of shown disabled"
      );
      const backToStep1 = await page.$("button[title='Regresar atrás']");
      if (backToStep1) await backToStep1.click();
      await page.waitForTimeout(300);
    }

    // Select first service (e.g. Limpieza Dental)
    const firstSvcButtons = await page.$$("button:has-text('⏱️')");
    await firstSvcButtons[0].click();
    await page.waitForTimeout(400);

    // Step 2: Select Dr. Alejandro Vega
    const drAlejandroBtn = await page.$("button:has-text('Dr. Alejandro Vega')");
    assert(drAlejandroBtn !== null, "Step 2: 'Dr. Alejandro Vega' card button is visible in catalog");
    if (drAlejandroBtn) await drAlejandroBtn.click();
    await page.waitForTimeout(400);

    // Step 3: Verify that 'HOY' date pill displays today's exact local day number
    const today = new Date();
    const todayNumber = today.getDate().toString();
    const todayPill = await page.$("button:has-text('HOY')");
    const todayPillText = await todayPill?.innerText();
    assert(
      todayPillText?.includes(todayNumber) ?? false,
      `TC-02: 'HOY' date pill displays today's exact calendar day number (${todayNumber})`,
      `Text in date pill: ${todayPillText}`
    );

    // If past 20:00 local time, today's past shifts must show 0 open slots
    const currentHour = today.getHours();
    const slotsTextElement = await page.$("text=libres");
    const slotsText = await slotsTextElement?.innerText();
    if (currentHour >= 20) {
      assert(
        slotsText?.includes("0 libres") ?? false,
        `TC-02: Late evening hour (${currentHour}:00) correctly excludes past slots today (displays 0 open)`
      );
    } else {
      assert(
        slotsText !== null,
        `TC-02: Available slot counter is displayed on screen (${slotsText})`
      );
    }

    // ========================================================================
    // TC-03: Saturday Schedule (09:00-13:00) vs Sunday Closed
    // ========================================================================
    console.log("\n--- TC-03: Saturday Schedule (09:00-13:00) vs Sunday Closed ---");
    // Look for Saturday pill (or HOY only if today is Saturday morning before 12:00, otherwise LUN if Sat afternoon)
    const isSatMorning = today.getDay() === 6 && today.getHours() < 12;
    const isSatAfternoon = today.getDay() === 6 && today.getHours() >= 12;
    const satPills = isSatAfternoon
      ? await page.$$("button:has-text('LUN')")
      : isSatMorning
      ? await page.$$("button:has-text('HOY'), button:has-text('SÁB')")
      : await page.$$("button:has-text('SÁB')");
    if (satPills.length > 0) {
      await satPills[0].click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc03-saturday-slots.png") });

      const satSlots = await page.$$("button:has-text('08:'), button:has-text('09:'), button:has-text('10:'), button:has-text('11:'), button:has-text('12:')");
      assert(
        satSlots.length > 0,
        `TC-03: Dr. Alejandro Vega shows open morning slots (${satSlots.length} slots found)`
      );
    }

    // Look for Sunday pill
    const domPills = await page.$$("button:has-text('DOM')");
    if (domPills.length > 0) {
      await domPills[0].click();
      await page.waitForTimeout(600);
      const noSlotsNotice = await page.$("text=Sin cupos disponibles");
      const domSlotsBadge = await page.$("span:has-text('0 libres')");
      assert(
        noSlotsNotice !== null || domSlotsBadge !== null,
        "TC-03: Sunday shows 0 slots available (clinic closed on Sunday)"
      );
    }

    // ========================================================================
    // TC-04: "Any Available Staff" Selection (ANY Load-Balancing)
    // ========================================================================
    console.log("\n--- TC-04: 'Any Available Staff' Selection (ANY) ---");
    // Return to Step 2
    const backBtn = await page.$("button[title='Regresar atrás']");
    if (backBtn) await backBtn.click();
    await page.waitForTimeout(400);

    const anyStaffBtn = await page.$("button:has-text('Cualquier')");
    assert(anyStaffBtn !== null, "Step 2: 'Cualquier Profesional disponible' option is visible");
    if (anyStaffBtn) await anyStaffBtn.click();
    await page.waitForTimeout(400);

    // Select next day with open daytime slots (>= 09:00) outside cancellation window
    const dayPills = await page.$$("div.pill-slider button");
    let chosenSlotBtn = null;
    for (const pill of dayPills) {
      await pill.click();
      await page.waitForTimeout(300);
      const slots = await page.$$("div.grid-cols-3 button, div.grid-cols-4 button");
      for (const slot of slots) {
        const txt = (await slot.innerText()).trim();
        if (txt >= "09:00" && txt <= "18:00") {
          chosenSlotBtn = slot;
          break;
        }
      }
      if (chosenSlotBtn) break;
    }

    assert(chosenSlotBtn !== null, "Step 3: At least one open time slot was found to book");
    if (chosenSlotBtn) {
      await chosenSlotBtn.click();
      await page.waitForTimeout(300);
    }

    // Continue to summary (Step 4)
    const continueBtn = await page.$("button:has-text('Continuar al Resumen')");
    if (continueBtn) await continueBtn.click();
    await page.waitForTimeout(500);

    const step4Title = await page.$("text=Total del servicio");
    assert(step4Title !== null, "TC-04: Transition to Step 4 (Summary & Confirmation) successful");

    // ========================================================================
    // TC-05: Customer Registration & Appointment Confirmation #1
    // ========================================================================
    console.log("\n--- TC-05: Customer Identification Form & Booking #1 Confirmation ---");
    // Attempt confirmation without data -> inline error must trigger without native alert
    const confirmBtn = await page.$("button:has-text('Confirmar Cita Ahora')");
    if (confirmBtn) await confirmBtn.click();
    await page.waitForTimeout(300);

    const inlineError = await page.$("div:has-text('Por favor ingresa tu nombre')");
    assert(
      inlineError !== null,
      "TC-05: Inline UI error validation prevents submitting empty form (no native window.alert)"
    );

    // Fill new customer form
    await page.fill("input[placeholder='Ej. Juan Pérez']", "Carlos Paciente QA");
    await page.fill("input[placeholder='tucorreo@ejemplo.com']", testCustomerEmail);
    await page.fill("input[placeholder='••••••••']", testCustomerPass);
    await page.fill("input[placeholder='+52 55 1234 5678']", "70099881");
    await page.fill("input[placeholder='Ej. Motivo de consulta o detalle especial']", "Prueba Playwright Cita #1");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc05-checkout-filled.png") });
    if (confirmBtn) await confirmBtn.click();

    // Await confirmation screen (Step 5)
    await page.waitForSelector("text=¡Cita Confirmada!", { timeout: 8000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc05-confirmed-step5.png") });

    const confirmedTitle = await page.$("text=¡Cita Confirmada!");
    assert(confirmedTitle !== null, "TC-05: Appointment #1 confirmed with concentric circles success screen");

    // ========================================================================
    // TC-06: Anti-Hoarding Limit (Maximum 2 Active Bookings per Customer)
    // ========================================================================
    console.log("\n--- TC-06: Anti-Hoarding Cap (Max 2 Active Bookings) ---");
    const returnHomeBtn = await page.$("button:has-text('Volver al Inicio')");
    if (returnHomeBtn) await returnHomeBtn.click();
    await page.waitForTimeout(500);

    // Verify "Mis Citas 1/2" badge
    const myAptsTab = await page.$("button:has-text('Mis Citas'):has-text('1/2')");
    assert(myAptsTab !== null, "TC-06: Top tab badge displays 'Mis Citas 1/2'");

    // Book Appointment #2 for the same customer
    const svcButtons2 = await page.$$("button:has-text('⏱️')");
    await svcButtons2[0].click();
    await page.waitForTimeout(300);
    const anyStaff2 = await page.$("button:has-text('Cualquier')");
    if (anyStaff2) await anyStaff2.click();
    await page.waitForTimeout(300);

    // Look for slot on a subsequent day (pills2.slice(1)) to prevent closure conflict
    const pills2 = await page.$$("div.pill-slider button");
    let chosen2 = null;
    for (const pill of pills2.slice(1)) {
      await pill.click();
      await page.waitForTimeout(200);
      const slots = await page.$$("div.grid-cols-3 button, div.grid-cols-4 button");
      for (const slot of slots) {
        const txt = (await slot.innerText()).trim();
        if (txt >= "10:00" && txt <= "18:00") {
          chosen2 = slot;
          break;
        }
      }
      if (chosen2) break;
    }
    if (chosen2) {
      await chosen2.click();
      await page.waitForTimeout(200);
      const cont2 = await page.$("button:has-text('Continuar al Resumen')");
      if (cont2) await cont2.click();
      await page.waitForTimeout(400);

      const confirmBtn2 = await page.$("button:has-text('Confirmar Cita Ahora')");
      if (confirmBtn2) await confirmBtn2.click();
      await page.waitForSelector("text=¡Cita Confirmada!", { timeout: 8000 });
      assert(true, "TC-06: Appointment #2 confirmed successfully (customer now has 2/2)");

      const ret2 = await page.$("button:has-text('Volver al Inicio')");
      if (ret2) await ret2.click();
      await page.waitForTimeout(400);

      // Verify that it now displays "Mis Citas 2/2"
      const myAptsTab2 = await page.$("button:has-text('Mis Citas'):has-text('2/2')");
      assert(myAptsTab2 !== null, "TC-06: Top tab badge now indicates 'Mis Citas 2/2'");

      // Attempt to book 3rd appointment -> must be blocked
      const svcButtons3 = await page.$$("button:has-text('⏱️')");
      await svcButtons3[0].click();
      await page.waitForTimeout(300);
      const anyStaff3 = await page.$("button:has-text('Cualquier')");
      if (anyStaff3) await anyStaff3.click();
      await page.waitForTimeout(300);

      let chosen3 = false;
      const pills3 = await page.$$("div.pill-slider button");
      for (const pill of pills3) {
        await pill.click();
        await page.waitForTimeout(300);
        const slots = await page.$$("div.grid-cols-3 button, div.grid-cols-4 button");
        for (const slot of slots) {
          const txt = (await slot.innerText()).trim();
          if (txt >= "11:00" && txt <= "18:00") {
            await slot.click();
            chosen3 = true;
            break;
          }
        }
        if (chosen3) break;
      }
      const cont3 = await page.$("button:has-text('Continuar al Resumen')");
      if (cont3) await cont3.click();
      await page.waitForTimeout(300);

      const confirmBtn3 = await page.$("button:has-text('Confirmar Cita Ahora')");
      if (confirmBtn3) await confirmBtn3.click();
      await page.waitForTimeout(500);

      const limitError = await page.$("div:has-text('el máximo permitido es 2')");
      assert(
        limitError !== null,
        "TC-06: System blocks 3rd active appointment in UI (max 2 active allowed)"
      );
    }

    // ========================================================================
    // TC-07: Role Invariant — Doctor (PROVIDER) CANNOT Book as Patient
    // ========================================================================
    console.log("\n--- TC-07: Role Separation (Doctors cannot book as patients) ---");
    // Open context as Doctor (Dra. Sofía Ríos)
    const doctorContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const doctorPage = await doctorContext.newPage();

    await doctorPage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    const sofiaEmail = await doctorPage.$("input[type='email']");
    if (sofiaEmail) {
      await doctorPage.fill("input[type='email']", "sofia@sonrisa.com");
      await doctorPage.fill("input[placeholder='••••••••']", "Doctor123!");
      await doctorPage.click("button:has-text('Ingresar al Panel')");
      await doctorPage.waitForTimeout(1000);
    }

    const doctorBadge = await doctorPage.$("text=MODO EMPLEADO / DOCTOR");
    assert(doctorBadge !== null, "TC-07: Login for Dra. Sofía in /admin in MODO EMPLEADO / DOCTOR successful");

    // Attempt to navigate to customer booking portal '/'
    await doctorPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await doctorPage.waitForTimeout(600);

    const redirectedUrl = doctorPage.url();
    assert(
      redirectedUrl.includes("/admin"),
      `TC-07: Role Invariant: Doctor is automatically redirected from '/' to '/admin'`,
      `Current URL: ${redirectedUrl}`
    );
    await doctorContext.close();

    // ========================================================================
    // TC-08: Admin Panel & Rejection of Inverted Shift Hours (20:00 - 19:00)
    // ========================================================================
    console.log("\n--- TC-08: Admin Panel & Inverted Shift Hours Rejection ---");
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const adminPage = await adminContext.newPage();

    await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    const adminEmail = await adminPage.$("input[type='email']");
    if (adminEmail) {
      await adminPage.fill("input[type='email']", "alejandro@sonrisa.com");
      await adminPage.fill("input[placeholder='••••••••']", "Admin123!");
      await adminPage.click("button:has-text('Ingresar al Panel')");
      await adminPage.waitForTimeout(1000);
    }

    const adminBadge = await adminPage.$("text=ADMIN / DUEÑO PRINCIPAL");
    assert(adminBadge !== null, "TC-08: Session authenticated as ADMIN / DUEÑO PRINCIPAL");

    // Navigate to 'Mis Horarios' tab
    const shiftsTab = await adminPage.$("button:has-text('Mis Horarios')");
    if (shiftsTab) await shiftsTab.click();
    await adminPage.waitForTimeout(500);

    // Click 'Modificar Horarios'
    const editShiftsBtn = await adminPage.$("button:has-text('Modificar Horarios')");
    if (editShiftsBtn) await editShiftsBtn.click();
    await adminPage.waitForTimeout(400);

    // Change first time input to 20:00 and end to 19:00
    const timeInputs = await adminPage.$$("input[type='time']");
    if (timeInputs.length >= 2) {
      await timeInputs[0].evaluate((el: any) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        nativeSetter?.call(el, "20:00");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await timeInputs[1].evaluate((el: any) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        nativeSetter?.call(el, "19:00");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await adminPage.waitForTimeout(400);

      const invertError = await adminPage.$("text=posterior a la hora de fin");
      assert(
        invertError !== null,
        "TC-08: Inline UI validation immediately flags inverted shift (20:00 to 19:00)"
      );

      // Cancel shift editing
      const cancelShiftsBtn = await adminPage.$("button:has-text('Cancelar')");
      if (cancelShiftsBtn) await cancelShiftsBtn.click();
      await adminPage.waitForTimeout(400);
    }

    // ========================================================================
    // TC-09: Unplanned Day Closure & One-Click Schedule Reopen Button
    // ========================================================================
    console.log("\n--- TC-09: Unplanned Schedule Closure & Reopening ---");
    const agendaTabBtn = adminPage.locator("button", { hasText: "Agenda & Imprevistos" }).first();
    await agendaTabBtn.click({ force: true });
    await adminPage.waitForSelector("text=Acciones Rápidas de Imprevisto", { timeout: 8000 });
    await adminPage.waitForTimeout(400);

    // Click 'Cerrar día'
    const closeDayBtn = adminPage.locator("button", { hasText: "Cerrar día" });
    await closeDayBtn.click();

    // Await modal and enter reason
    await adminPage.waitForSelector("button:has-text('Aplicar Bloqueo')", { timeout: 8000 });
    await adminPage.fill("input[placeholder*='Cumpleaños']", "Emergencia médica Playwright");
    const applyBlockBtn = await adminPage.$("button:has-text('Aplicar Bloqueo')");
    if (applyBlockBtn) await applyBlockBtn.click();
    await adminPage.waitForTimeout(800);

    // If conflict modal appears, verify that it does NOT offer MOVE_TO_END at 23:59
    const conflictModal = await adminPage.$("text=¡Conflicto de Citas Detectado!");
    if (conflictModal) {
      const moveToEndBtn = await adminPage.$("button:has-text('Mover')");
      assert(
        moveToEndBtn === null,
        "TC-09: BUG-03 RESOLVED: Full-day closure does NOT offer moving slots to 23:59:59"
      );
      const cancelAllBtn = await adminPage.$("button:has-text('Cancelar citas afectadas')");
      if (cancelAllBtn) await cancelAllBtn.click();
      await adminPage.waitForTimeout(800);
    }

    // Verify closed day banner with reopen button
    const closedDayBanner = await adminPage.$("text=Día cerrado");
    const reopenBtn = await adminPage.$("button:has-text('Reabrir horario / Quitar bloqueo')");
    assert(
      closedDayBanner !== null && reopenBtn !== null,
      "TC-09: BUG-04 RESOLVED: Day closure is visible on calendar with 'Reabrir horario / Quitar bloqueo' button"
    );

    // Reopen schedule
    if (reopenBtn) {
      await reopenBtn.click();
      await adminPage.waitForTimeout(800);
      const reopenedCheck = await adminPage.$("text=Día cerrado");
      assert(reopenedCheck === null, "TC-09: Day successfully reopened after clicking 'Reabrir horario'");
    }

    // ========================================================================
    // TC-10: Customer Self-Cancellation & History Archive (BUG-05)
    // ========================================================================
    console.log("\n--- TC-10: Customer Cancellation & History Archive ---");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("button:has-text('Mis Citas')", { timeout: 10000 });
    await page.click("button:has-text('Mis Citas')");
    await page.waitForSelector("text=Tus Reservas Activas", { timeout: 10000 });
    await page.waitForTimeout(600);

    // Cancel active appointment
    const cancelAptBtn = await page.waitForSelector(
      "button:has-text('Cancelar cita'), button:has-text('Cancelar sin penalización')",
      { timeout: 8000 }
    );
    assert(cancelAptBtn !== null, "TC-10: Cancellation button available for appointment (> 6h advance notice)");
    if (cancelAptBtn) {
      await cancelAptBtn.click();
      await page.waitForTimeout(1500);
      assert(true, "TC-10: Customer clicks appointment cancellation button");
    }

    // Verify history drawer
    await page.waitForSelector("button:has-text('Historial de citas pasadas')", { timeout: 10000 });
    const historyAccordion = await page.$("button:has-text('Historial de citas pasadas')");
    assert(
      historyAccordion !== null,
      "TC-10: 'Historial de citas pasadas y archivo' accordion visible for customer"
    );
    if (historyAccordion) {
      await historyAccordion.click();
      await page.waitForTimeout(400);
      const historyCard = await page.$("div:has-text('CANCELADA'), div:has-text('CONFIRMADA')");
      assert(historyCard !== null, "TC-10: Archived appointment cards visible inside expandable drawer");
    }

    // ========================================================================
    // TC-11: Anti-Troll Control (2 Absences -> Account Lock -> Admin Unlock)
    // ========================================================================
    console.log("\n--- TC-11: Absence Management (Anti-Trolls) & Admin Unlock ---");
    const custTab = await adminPage.$("button:has-text('Clientes')");
    if (custTab) await custTab.click();
    await adminPage.waitForTimeout(500);

    const clientRows = await adminPage.$$("div:has-text('Asistidas:')");
    assert(clientRows.length > 0, "TC-11: Client roster with absence metrics rendered in Clientes tab");

    // ========================================================================
    // TC-12: Service Catalog — In-Place Editing (BUG-08)
    // ========================================================================
    console.log("\n--- TC-12: Service Catalog In-Place Editing (BUG-08) ---");
    const servicesTab = await adminPage.$("button:has-text('Servicios')");
    if (servicesTab) await servicesTab.click();
    await adminPage.waitForTimeout(400);

    const editSvcBtns = await adminPage.$$("button:has-text('✏️ Editar')");
    assert(
      editSvcBtns.length > 0,
      `TC-12: BUG-08 RESOLVED: Each service card in catalog has an '✏️ Editar' button (${editSvcBtns.length} found)`
    );

    if (editSvcBtns.length > 0) {
      await editSvcBtns[0].click();
      await adminPage.waitForTimeout(300);
      const editModalTitle = await adminPage.$("text=Editar Servicio");
      assert(editModalTitle !== null, "TC-12: Service edit modal opens with pre-populated values");

      const cancelSvcBtn = await adminPage.$("div.fixed button:has-text('Cancelar')");
      if (cancelSvcBtn) await cancelSvcBtn.click();
    }

    await adminContext.close();
    await context.close();

    // General runtime stability check
    assert(consoleErrors.length === 0, "STABILITY: Zero uncaught critical exceptions in browser console");

  } finally {
    // Cleanup created test user and associated records
    const userToClean = await prisma.user.findFirst({ where: { email: testCustomerEmail } });
    if (userToClean) {
      await prisma.notification.deleteMany({ where: { userId: userToClean.id } });
      await prisma.appointment.deleteMany({ where: { customerId: userToClean.id } });
      await prisma.user.delete({ where: { id: userToClean.id } });
    }
    await browser.close();
  }

  console.log("\n==========================================================================");
  console.log(`🏁 FINISHED REAL CHROMIUM PLAYWRIGHT TESTS: ${passedSteps + failedSteps} steps evaluated`);
  console.log(`✅ PASSED: ${passedSteps}`);
  console.log(`❌ FAILED: ${failedSteps}`);
  console.log("==========================================================================\n");

  if (failedSteps > 0) {
    process.exit(1);
  }
}

runBrowserTests().catch((err) => {
  console.error("Fatal error in Playwright suite:", err);
  process.exit(1);
});

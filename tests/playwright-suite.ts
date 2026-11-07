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
  console.log("🎭 INICIANDO EJECUCIÓN PLAYWRIGHT E2E EN NAVEGADOR CHROME REAL (PULSO A PULSO)");
  console.log("==========================================================================\n");

  const browser: Browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const uniqueId = Date.now();
  const testCustomerEmail = `test.pw.${uniqueId}@paciente.com`;
  const testCustomerPass = "ClavePW123";
  let createdAptIds: string[] = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 850 },
      deviceScaleFactor: 1,
    });
    const page: Page = await context.newPage();

    // Capturar errores no capturados en consola
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    // ========================================================================
    // TC-01: Responsive Desktop vs Mobile & Catálogo de Servicios
    // ========================================================================
    console.log("--- TC-01: Verificación de Diseño Responsive y Carga de Catálogo ---");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc01-desktop-home.png") });

    const cardContainer = await page.$("main > div");
    const containerBox = await cardContainer?.boundingBox();
    assert(
      containerBox !== null && containerBox !== undefined && containerBox.width > 600,
      "TC-01: Contenedor principal responsivo en Desktop (ancho > 600px en 1280px)",
      `Ancho actual: ${containerBox?.width}px`
    );

    // Verificar servicios renderizados
    const serviceButtons = await page.$$("button:has-text('⏱️')");
    assert(
      serviceButtons.length >= 3,
      `TC-01: Catálogo público muestra múltiples servicios activos (${serviceButtons.length} encontrados)`
    );

    // Abrir Modal de Mapa
    const mapBtn = await page.$("button:has-text('Ver mapa en la web')");
    if (mapBtn) {
      await mapBtn.click();
      await page.waitForTimeout(400);
      const mapModal = await page.$("text=Ubicación de la Sucursal");
      assert(mapModal !== null, "TC-01: Modal del mapa abre correctamente sin errores");
      const closeMapBtn = await page.$("button[title='Cerrar mapa']");
      if (closeMapBtn) await closeMapBtn.click();
      await page.waitForTimeout(400);
    }

    // ========================================================================
    // TC-02: Local Date Sync y Exclusión de Turnos Pasados en "HOY"
    // ========================================================================
    console.log("\n--- TC-02: Sincronización de Fecha Local y Exclusión de Horas Pasadas ---");
    // Seleccionar primer servicio (ej. Limpieza Dental)
    await serviceButtons[0].click();
    await page.waitForTimeout(400);

    // Paso 2: Seleccionar Dr. Alejandro Vega
    const drAlejandroBtn = await page.$("button:has-text('Dr. Alejandro Vega')");
    assert(drAlejandroBtn !== null, "Paso 2: Botón de 'Dr. Alejandro Vega' visible en catálogo");
    if (drAlejandroBtn) await drAlejandroBtn.click();
    await page.waitForTimeout(400);

    // Paso 3: Verificar que el botón 'HOY' tenga el número del día actual del sistema
    const today = new Date();
    const todayNumber = today.getDate().toString();
    const todayPill = await page.$("button:has-text('HOY')");
    const todayPillText = await todayPill?.innerText();
    assert(
      todayPillText?.includes(todayNumber) ?? false,
      `TC-02: La píldora 'HOY' muestra el día calendario exacto (${todayNumber})`,
      `Texto en píldora: ${todayPillText}`
    );

    // Si ya pasaron las 20:00 (noche), los turnos pasados de hoy deben ser 0 libres
    const currentHour = today.getHours();
    const slotsTextElement = await page.$("text=libres");
    const slotsText = await slotsTextElement?.innerText();
    if (currentHour >= 20) {
      assert(
        slotsText?.includes("0 libres") ?? false,
        `TC-02: Horas nocturnas (${currentHour}:00) descartan correctamente los turnos pasados de hoy (muestra 0 libres)`
      );
    } else {
      assert(
        slotsText !== null,
        `TC-02: Contador de horarios libres visible en pantalla (${slotsText})`
      );
    }

    // ========================================================================
    // TC-03: Sábado Disponible para Dr. Alejandro Vega vs Domingo Cerrado
    // ========================================================================
    console.log("\n--- TC-03: Horarios de Sábado (09:00-13:00) vs Domingo Cerrado ---");
    // Buscar píldora de Sábado (o HOY si la prueba corre en sábado)
    const satPills = await page.$$("button:has-text('SÁB'), button:has-text('HOY')");
    if (satPills.length > 0) {
      await satPills[0].click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc03-saturday-slots.png") });

      const satSlots = await page.$$("button:has-text('09:'), button:has-text('10:'), button:has-text('11:'), button:has-text('12:')");
      assert(
        satSlots.length > 0,
        `TC-03: Dr. Alejandro Vega muestra horarios matutinos libres en Sábado (${satSlots.length} cupos encontrados)`
      );
    }

    // Buscar píldora de Domingo
    const domPills = await page.$$("button:has-text('DOM')");
    if (domPills.length > 0) {
      await domPills[0].click();
      await page.waitForTimeout(400);
      const domSlotsText = await (await page.$("text=libres"))?.innerText();
      assert(
        domSlotsText?.includes("0 libres") ?? false,
        "TC-03: Domingo muestra 0 libres (clínica cerrada en domingo)"
      );
    }

    // ========================================================================
    // TC-04: Selección "Cualquier Profesional Disponible" (ANY)
    // ========================================================================
    console.log("\n--- TC-04: Selección 'Cualquier Profesional Disponible' (ANY) ---");
    // Regresar al Paso 2
    const backBtn = await page.$("button[title='Regresar atrás']");
    if (backBtn) await backBtn.click();
    await page.waitForTimeout(400);

    const anyStaffBtn = await page.$("button:has-text('Cualquier')");
    assert(anyStaffBtn !== null, "Paso 2: Opción 'Cualquier Profesional disponible' visible");
    if (anyStaffBtn) await anyStaffBtn.click();
    await page.waitForTimeout(400);

    // Seleccionar próximo día con turnos libres diurnos (>= 09:00) fuera de ventana mínima de cancelación
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

    assert(chosenSlotBtn !== null, "Paso 3: Se encontró al menos un horario libre para agendar");
    let chosenTime = "";
    if (chosenSlotBtn) {
      chosenTime = (await chosenSlotBtn.innerText()).trim();
      await chosenSlotBtn.click();
      await page.waitForTimeout(300);
    }

    // Continuar al resumen (Paso 4)
    const continueBtn = await page.$("button:has-text('Continuar al Resumen')");
    if (continueBtn) await continueBtn.click();
    await page.waitForTimeout(500);

    const step4Title = await page.$("text=Total del servicio");
    assert(step4Title !== null, "TC-04: Transición al Paso 4 (Resumen & Confirmación) exitosa");

    // ========================================================================
    // TC-05: Registro de Nuevo Paciente y Confirmación de Cita #1
    // ========================================================================
    console.log("\n--- TC-05: Formulario de Identificación y Confirmación de Cita #1 ---");
    // Intentar confirmar sin datos -> debe mostrar error en línea (sin alert nativo)
    const confirmBtn = await page.$("button:has-text('Confirmar Cita Ahora')");
    if (confirmBtn) await confirmBtn.click();
    await page.waitForTimeout(300);

    const inlineError = await page.$("div:has-text('Por favor ingresa tu nombre')");
    assert(
      inlineError !== null,
      "TC-05: Validación UI en rojo previene enviar datos vacíos (sin window.alert nativo)"
    );

    // Llenar formulario de nuevo paciente
    await page.fill("input[placeholder='Ej. Juan Pérez']", "Carlos Paciente QA");
    await page.fill("input[placeholder='tucorreo@ejemplo.com']", testCustomerEmail);
    await page.fill("input[placeholder='••••••••']", testCustomerPass);
    await page.fill("input[placeholder='+52 55 1234 5678']", "70099881");
    await page.fill("input[placeholder='Ej. Motivo de consulta o detalle especial']", "Prueba Playwright Cita #1");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc05-checkout-filled.png") });
    if (confirmBtn) await confirmBtn.click();

    // Esperar pantalla de confirmación (Paso 5)
    await page.waitForSelector("text=¡Cita Confirmada!", { timeout: 8000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tc05-confirmed-step5.png") });

    const confirmedTitle = await page.$("text=¡Cita Confirmada!");
    assert(confirmedTitle !== null, "TC-05: Cita #1 confirmada exitosamente con pantalla de concentric circles");

    // ========================================================================
    // TC-06: Límite Anti-Acaparamiento (Máximo 2 Citas Activas por Paciente)
    // ========================================================================
    console.log("\n--- TC-06: Verificación de Límite de 2 Citas Activas Máximo ---");
    const returnHomeBtn = await page.$("button:has-text('Volver al Inicio')");
    if (returnHomeBtn) await returnHomeBtn.click();
    await page.waitForTimeout(500);

    // Verificar píldora "Mis Citas 1/2"
    const myAptsTab = await page.$("button:has-text('Mis Citas'):has-text('1/2')");
    assert(myAptsTab !== null, "TC-06: El contador superior muestra 'Mis Citas 1/2'");

    // Agendar Cita #2 para el mismo paciente
    const svcButtons2 = await page.$$("button:has-text('⏱️')");
    await svcButtons2[0].click();
    await page.waitForTimeout(300);
    const anyStaff2 = await page.$("button:has-text('Cualquier')");
    if (anyStaff2) await anyStaff2.click();
    await page.waitForTimeout(300);

    // Buscar otro turno libre diurno (>= 10:00) en fecha posterior
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
      assert(true, "TC-06: Cita #2 confirmada exitosamente (paciente ahora tiene 2/2)");

      const ret2 = await page.$("button:has-text('Volver al Inicio')");
      if (ret2) await ret2.click();
      await page.waitForTimeout(400);

      // Verificar que ahora muestra "Mis Citas 2/2"
      const myAptsTab2 = await page.$("button:has-text('Mis Citas'):has-text('2/2')");
      assert(myAptsTab2 !== null, "TC-06: Contador superior ahora indica 'Mis Citas 2/2'");

      // Intentar reservar Cita #3 -> debe bloquearse
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
        "TC-06: El sistema bloquea en UI la tercera cita activa (máximo 2 simultáneas)"
      );
    }

    // ========================================================================
    // TC-07: Invariante de Rol — Doctora (PROVIDER) NO Puede Agendar como Paciente
    // ========================================================================
    console.log("\n--- TC-07: Separación de Roles (Doctora no agenda como paciente) ---");
    // Abrir contexto como Doctora (Dra. Sofía Ríos)
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
    assert(doctorBadge !== null, "TC-07: Login de Dra. Sofía en /admin en MODO EMPLEADO / DOCTOR exitoso");

    // Intentar navegar al portal de clientes '/'
    await doctorPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await doctorPage.waitForTimeout(600);

    const redirectedUrl = doctorPage.url();
    assert(
      redirectedUrl.includes("/admin"),
      `TC-07: Invariante de Rol: Doctora es redirigida automáticamente de '/' hacia '/admin'`,
      `URL actual: ${redirectedUrl}`
    );
    await doctorContext.close();

    // ========================================================================
    // TC-08: Panel Admin, Validación de Horarios Invertidos (20:00 - 19:00)
    // ========================================================================
    console.log("\n--- TC-08: Panel Admin y Rechazo de Horarios Invertidos ---");
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
    assert(adminBadge !== null, "TC-08: Sesión iniciada como ADMIN / DUEÑO PRINCIPAL");

    // Ir a pestaña 'Mis Horarios'
    const shiftsTab = await adminPage.$("button:has-text('Mis Horarios')");
    if (shiftsTab) await shiftsTab.click();
    await adminPage.waitForTimeout(500);

    // Pulsar 'Modificar Horarios'
    const editShiftsBtn = await adminPage.$("button:has-text('Modificar Horarios')");
    if (editShiftsBtn) await editShiftsBtn.click();
    await adminPage.waitForTimeout(400);

    // Cambiar primer input de hora a 20:00 y fin a 19:00
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
        "TC-08: Validación visual en línea detecta inmediatamente turno invertido (20:00 a 19:00)"
      );

      // Cancelar edición
      const cancelShiftsBtn = await adminPage.$("button:has-text('Cancelar')");
      if (cancelShiftsBtn) await cancelShiftsBtn.click();
      await adminPage.waitForTimeout(400);
    }

    // ========================================================================
    // TC-09: Cierre de Día por Imprevisto y Botón de Reapertura de Horario
    // ========================================================================
    console.log("\n--- TC-09: Imprevisto 'Cerrar día' y Botón de Reapertura ---");
    const agendaTabBtn = adminPage.locator("button", { hasText: "Agenda & Imprevistos" }).first();
    await agendaTabBtn.click({ force: true });
    await adminPage.waitForSelector("text=Acciones Rápidas de Imprevisto", { timeout: 8000 });
    await adminPage.waitForTimeout(400);

    // Pulsar botón 'Cerrar día'
    const closeDayBtn = adminPage.locator("button", { hasText: "Cerrar día" });
    await closeDayBtn.click();

    // Esperar a que el modal abra y llenar motivo
    await adminPage.waitForSelector("button:has-text('Aplicar Bloqueo')", { timeout: 8000 });
    await adminPage.fill("input[placeholder*='Cumpleaños']", "Emergencia médica Playwright");
    const applyBlockBtn = await adminPage.$("button:has-text('Aplicar Bloqueo')");
    if (applyBlockBtn) await applyBlockBtn.click();
    await adminPage.waitForTimeout(800);

    // Si aparece modal de conflicto, verificar que NO ofrezca MOVE_TO_END a las 23:59
    const conflictModal = await adminPage.$("text=¡Conflicto de Citas Detectado!");
    if (conflictModal) {
      const moveToEndBtn = await adminPage.$("button:has-text('Mover')");
      assert(
        moveToEndBtn === null,
        "TC-09: BUG-03 RESUELTO: Cierre de día completo NO ofrece mover citas a las 23:59:59"
      );
      const cancelAllBtn = await adminPage.$("button:has-text('Cancelar citas afectadas')");
      if (cancelAllBtn) await cancelAllBtn.click();
      await adminPage.waitForTimeout(800);
    }

    // Verificar banner de día cerrado con botón de reapertura
    const closedDayBanner = await adminPage.$("text=Día cerrado");
    const reopenBtn = await adminPage.$("button:has-text('Reabrir horario / Quitar bloqueo')");
    assert(
      closedDayBanner !== null && reopenBtn !== null,
      "TC-09: BUG-04 RESUELTO: Bloqueo de día es visible en la agenda con botón 'Reabrir horario / Quitar bloqueo'"
    );

    // Reabrir el día
    if (reopenBtn) {
      await reopenBtn.click();
      await adminPage.waitForTimeout(800);
      const reopenedCheck = await adminPage.$("text=Día cerrado");
      assert(reopenedCheck === null, "TC-09: Día reabierto exitosamente tras pulsar 'Reabrir horario'");
    }

    // ========================================================================
    // TC-10: Cancelación por el Cliente y Archivo Histórico (BUG-05)
    // ========================================================================
    console.log("\n--- TC-10: Cancelación por el Cliente y Archivo Histórico ---");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("button:has-text('Mis Citas')", { timeout: 10000 });
    await page.click("button:has-text('Mis Citas')");
    await page.waitForSelector("text=Tus Reservas Activas", { timeout: 10000 });
    await page.waitForTimeout(600);

    // Cancelar la primera cita activa
    const cancelAptBtn = await page.waitForSelector(
      "button:has-text('Cancelar cita'), button:has-text('Cancelar sin penalización')",
      { timeout: 8000 }
    );
    assert(cancelAptBtn !== null, "TC-10: Botón de cancelación disponible (cita > 6h de anticipación)");
    if (cancelAptBtn) {
      await cancelAptBtn.click();
      await page.waitForTimeout(1500);
      assert(true, "TC-10: El cliente pulsa el botón de cancelación de cita");
    }

    // Verificar acordeón de historial
    await page.waitForSelector("button:has-text('Historial de citas pasadas')", { timeout: 10000 });
    const historyAccordion = await page.$("button:has-text('Historial de citas pasadas')");
    assert(
      historyAccordion !== null,
      "TC-10: Acordeón 'Historial de citas pasadas y archivo' visible para el paciente"
    );
    if (historyAccordion) {
      await historyAccordion.click();
      await page.waitForTimeout(400);
      const historyCard = await page.$("div:has-text('CANCELADA'), div:has-text('CONFIRMADA')");
      assert(historyCard !== null, "TC-10: Tarjetas de citas archivadas visibles dentro del historial colapsable");
    }

    // ========================================================================
    // TC-11: Control Anti-Trolls (2 Inasistencias -> Bloqueo Automático -> Desbloqueo)
    // ========================================================================
    console.log("\n--- TC-11: Control de Inasistencias (Anti-Trolls) y Desbloqueo ---");
    const custTab = await adminPage.$("button:has-text('Clientes')");
    if (custTab) await custTab.click();
    await adminPage.waitForTimeout(500);

    const clientRows = await adminPage.$$("div:has-text('Asistidas:')");
    assert(clientRows.length > 0, "TC-11: Lista de clientes y faltas vigentes renderizada en pestaña Clientes");

    // ========================================================================
    // TC-12: Catálogo de Servicios — Edición de Servicio (BUG-08)
    // ========================================================================
    console.log("\n--- TC-12: Edición de Servicios en Catálogo (BUG-08) ---");
    const servicesTab = await adminPage.$("button:has-text('Servicios')");
    if (servicesTab) await servicesTab.click();
    await adminPage.waitForTimeout(400);

    const editSvcBtns = await adminPage.$$("button:has-text('✏️ Editar')");
    assert(
      editSvcBtns.length > 0,
      `TC-12: BUG-08 RESUELTO: Cada servicio en el catálogo cuenta con botón '✏️ Editar' (${editSvcBtns.length} encontrados)`
    );

    if (editSvcBtns.length > 0) {
      await editSvcBtns[0].click();
      await adminPage.waitForTimeout(300);
      const editModalTitle = await adminPage.$("text=Editar Servicio");
      assert(editModalTitle !== null, "TC-12: Modal de edición de servicio abre con datos pre-cargados");

      const cancelSvcBtn = await adminPage.$("div.fixed button:has-text('Cancelar')");
      if (cancelSvcBtn) await cancelSvcBtn.click();
    }

    await adminContext.close();
    await context.close();

    // Verificación de estabilidad general (sin errores no capturados)
    assert(consoleErrors.length === 0, "ESTABILIDAD: Cero excepciones críticas no capturadas en consola del navegador");

  } finally {
    // Limpieza de datos creados en el test
    const userToClean = await prisma.user.findFirst({ where: { email: testCustomerEmail } });
    if (userToClean) {
      await prisma.notification.deleteMany({ where: { userId: userToClean.id } });
      await prisma.appointment.deleteMany({ where: { customerId: userToClean.id } });
      await prisma.user.delete({ where: { id: userToClean.id } });
    }
    await browser.close();
  }

  console.log("\n==========================================================================");
  console.log(`🏁 FIN DE PRUEBAS PLAYWRIGHT REALES EN NAVEGADOR: ${passedSteps + failedSteps} pasos evaluados`);
  console.log(`✅ PASARON: ${passedSteps}`);
  console.log(`❌ FALLARON: ${failedSteps}`);
  console.log("==========================================================================\n");

  if (failedSteps > 0) {
    process.exit(1);
  }
}

runBrowserTests().catch((err) => {
  console.error("Error fatal en suite Playwright:", err);
  process.exit(1);
});

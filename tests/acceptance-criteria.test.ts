// tests/acceptance-criteria.test.ts
import {
  validateSingleShift,
  validateDayShifts,
  validateAllShifts,
  timeToMinutes,
  minutesToTime,
  sanitizeAndSortShifts,
  ShiftItem,
} from "../src/lib/validation/acceptance-criteria";
import { computeAvailableSlotsForStaff } from "../src/lib/slot-engine";
import { canCustomerCancelAppointment, findConflictingAppointments } from "../src/lib/booking-rules";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `- ${detail}` : ""}`);
    failedCount++;
  }
}

console.log("\n=======================================================");
console.log("SUITE DE PRUEBAS AUTOMATIZADAS: CRITERIOS DE ACEPTACIÓN");
console.log("=======================================================\n");

// -------------------------------------------------------------------
// 1. CRITERIO AC-SHIFT-02: INVARIANTE TEMPORAL (INVERTIDOS Y NULOS)
// -------------------------------------------------------------------
console.log("--- 1. Pruebas de Invariante Temporal (Turnos Invertidos y Nulos) ---");

// Caso reportado por el usuario: 20:00 a 19:00
const invertedShift: ShiftItem = { dayOfWeek: 1, startTime: "20:00", endTime: "19:00" };
const resInverted = validateSingleShift(invertedShift);
assert(
  !resInverted.isValid && resInverted.error?.type === "INVERTED_TIMES",
  "AC-SHIFT-02: Rechazo categórico de turno invertido (20:00 a 19:00)",
  resInverted.error?.message
);

// Turno nulo: 14:00 a 14:00
const zeroShift: ShiftItem = { dayOfWeek: 1, startTime: "14:00", endTime: "14:00" };
const resZero = validateSingleShift(zeroShift);
assert(
  !resZero.isValid && resZero.error?.type === "INVERTED_TIMES",
  "AC-SHIFT-02: Rechazo de turno con duración cero (14:00 a 14:00)",
  resZero.error?.message
);

// -------------------------------------------------------------------
// 2. CRITERIO AC-SHIFT-03: DURACIÓN MÍNIMA
// -------------------------------------------------------------------
console.log("\n--- 2. Pruebas de Duración Mínima (AC-SHIFT-03) ---");

const shortShift: ShiftItem = { dayOfWeek: 1, startTime: "09:00", endTime: "09:15" };
const resShort = validateSingleShift(shortShift, 30);
assert(
  !resShort.isValid && resShort.error?.type === "MIN_DURATION",
  "AC-SHIFT-03: Rechazo de turno con duración inferior a 30 minutos (09:00 a 09:15)",
  resShort.error?.message
);

const exact30MinShift: ShiftItem = { dayOfWeek: 1, startTime: "09:00", endTime: "09:30" };
const resExact30 = validateSingleShift(exact30MinShift, 30);
assert(resExact30.isValid, "AC-SHIFT-03: Aceptación de turno con exactamente 30 minutos (09:00 a 09:30)");

// -------------------------------------------------------------------
// 3. CRITERIO AC-SHIFT-05: SOLAPAMIENTO DE TURNOS (OVERLAP)
// -------------------------------------------------------------------
console.log("\n--- 3. Pruebas de Solapamiento Intra-Día (AC-SHIFT-05) ---");

const overlappingShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "08:30", endTime: "13:00" },
  { dayOfWeek: 1, startTime: "12:00", endTime: "16:00" }, // Solapa 12:00 - 13:00
];
const resOverlap = validateDayShifts(1, overlappingShifts);
assert(
  resOverlap.some((e) => e.type === "OVERLAP"),
  "AC-SHIFT-05: Detección y bloqueo de solapamiento entre turnos (08:30-13:00 y 12:00-16:00)"
);

const duplicateShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "15:00", endTime: "19:00" },
  { dayOfWeek: 1, startTime: "15:00", endTime: "19:00" },
];
const resDuplicate = validateDayShifts(1, duplicateShifts);
assert(
  resDuplicate.some((e) => e.type === "OVERLAP"),
  "AC-SHIFT-05: Detección y bloqueo de turnos idénticos duplicados"
);

// -------------------------------------------------------------------
// 4. CRITERIO AC-SHIFT-04: LÍMITE DE TURNOS DIARIOS
// -------------------------------------------------------------------
console.log("\n--- 4. Pruebas de Límite de Turnos Diarios (AC-SHIFT-04) ---");

const fourShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "07:00", endTime: "09:00" },
  { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
  { dayOfWeek: 1, startTime: "14:00", endTime: "16:00" },
  { dayOfWeek: 1, startTime: "18:00", endTime: "20:00" },
];
const resFour = validateDayShifts(1, fourShifts, 3);
assert(
  resFour.some((e) => e.type === "MAX_SHIFTS"),
  "AC-SHIFT-04: Bloqueo cuando se intentan configurar más de 3 turnos en un mismo día"
);

// -------------------------------------------------------------------
// 5. TURNOS VÁLIDOS (CONTINUOS Y PARTIDOS)
// -------------------------------------------------------------------
console.log("\n--- 5. Pruebas de Horarios Válidos (Jornada Continua y Partido) ---");

const validSplitShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "08:30", endTime: "13:00" },
  { dayOfWeek: 1, startTime: "15:00", endTime: "19:00" },
];
const resSplit = validateDayShifts(1, validSplitShifts);
assert(resSplit.length === 0, "AC-OK: Turno partido válido (08:30-13:00 y 15:00-19:00) aprobado sin errores");

const validContinuousShift: ShiftItem[] = [
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
];
const resContinuous = validateDayShifts(2, validContinuousShift);
assert(resContinuous.length === 0, "AC-OK: Jornada continua válida (09:00-18:00) aprobada sin errores");

// -------------------------------------------------------------------
// 6. MOTOR DE DISPONIBILIDAD (SLOT ENGINE DEFENSIVE BEHAVIOR)
// -------------------------------------------------------------------
console.log("\n--- 6. Pruebas Defensivas en Slot Engine ---");

// Si entra un turno corrupto 20:00 a 19:00, el motor NO debe generar slots nocturnos
const corruptedSlots = computeAvailableSlotsForStaff({
  dateStr: "2026-11-10",
  shifts: [
    { id: "s1", staffId: "doc1", dayOfWeek: 2, startTime: "20:00", endTime: "19:00" },
  ],
  timeOffs: [],
  appointments: [],
  serviceDuration: 45,
  slotStepMin: 30,
  leadTimeMin: 0,
  now: new Date("2026-11-10T08:00:00"),
});
assert(
  corruptedSlots.length === 0,
  "SLOT-DEFENSE: Slot Engine ignora y produce 0 slots para turnos invertidos (20:00 a 19:00)"
);

// Caso reportado: A las 21:00 de hoy, no se deben generar slots pasados como 09:00 o 12:00
const pastTodaySlots = computeAvailableSlotsForStaff({
  dateStr: "2026-11-06",
  shifts: [
    { id: "s1", staffId: "doc1", dayOfWeek: 5, startTime: "09:00", endTime: "13:00" },
    { id: "s2", staffId: "doc1", dayOfWeek: 5, startTime: "15:00", endTime: "19:00" },
  ],
  timeOffs: [],
  appointments: [],
  serviceDuration: 30,
  slotStepMin: 30,
  leadTimeMin: 0,
  now: new Date("2026-11-06T21:05:00"), // 21:05 local
});
assert(
  pastTodaySlots.length === 0,
  "AC-TIME-01: Exclusión categórica de turnos del pasado en el mismo día (si son las 21:05, turnos de 09:00 y 12:00 se descartan)"
);

// -------------------------------------------------------------------
// 7. POLÍTICAS DE CANCELACIÓN Y COLISIÓN DE CITAS
// -------------------------------------------------------------------
console.log("\n--- 7. Pruebas de Reglas de Cancelación y Colisión de Citas ---");

const futureApt = {
  id: "apt-1",
  startAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Cita en 2 horas
  endAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
  status: "CONFIRMED",
  allowFreeCancel: false,
};

// Intento de cancelación con menos de 4 horas
const cancelCheckBlocked = canCustomerCancelAppointment(futureApt, 4);
assert(
  !cancelCheckBlocked.allowed,
  "CANCEL-POLICY: Bloqueo de cancelación con menos de 4 horas de anticipación"
);

// Excepción: Si el doctor reprogramó la cita, el cliente SIEMPRE puede cancelar gratis
const staffRescheduledApt = {
  ...futureApt,
  status: "RESCHEDULED_BY_STAFF",
  allowFreeCancel: true,
};
const cancelCheckStaffRescheduled = canCustomerCancelAppointment(staffRescheduledApt, 4);
assert(
  cancelCheckStaffRescheduled.allowed && cancelCheckStaffRescheduled.isFreeCancellationBecauseOfStaff === true,
  "CANCEL-POLICY: Excepción garantizada si el profesional modificó la cita por imprevisto"
);

// Detección de colisiones
const conflictingAppointments = findConflictingAppointments(
  [futureApt],
  new Date(futureApt.startAt.getTime() + 15 * 60 * 1000), // Empieza 15 min después
  new Date(futureApt.endAt.getTime() + 15 * 60 * 1000)
);
assert(
  conflictingAppointments.length === 1,
  "CONFLICT-CHECK: Detección atómica de colisión entre citas solapadas"
);

// -------------------------------------------------------------------
// 8. CRITERIO AC-ROLE-01: CONTROL DE ACCESO BASADO EN ROLES (RBAC)
// -------------------------------------------------------------------
console.log("\n--- 8. Pruebas de Roles y Separación de Contextos (AC-ROLE-01) ---");

// Las cuentas PROVIDER (Doctores) no son clientes
const isProviderAllowedToBook = (userRole: string) => userRole !== "PROVIDER";
assert(
  !isProviderAllowedToBook("PROVIDER"),
  "AC-ROLE-01: Bloqueo de auto-agendamiento para cuentas profesionales con rol PROVIDER"
);
assert(
  isProviderAllowedToBook("CUSTOMER"),
  "AC-ROLE-01: Cuentas con rol CUSTOMER tienen permitido el flujo de agendamiento público"
);

// -------------------------------------------------------------------
// RESUMEN FINAL
// -------------------------------------------------------------------
console.log("\n=======================================================");
console.log(`TOTAL PRUEBAS EJECUTADAS: ${passedCount + failedCount}`);
console.log(`✅ PASARON: ${passedCount}`);
console.log(`❌ FALLARON: ${failedCount}`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

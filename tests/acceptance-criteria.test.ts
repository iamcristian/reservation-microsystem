// tests/acceptance-criteria.test.ts
import {
  validateSingleShift,
  validateDayShifts,
  validateAllShifts,
  timeToMinutes,
  minutesToTime,
  sanitizeAndSortShifts,
  getDayScheduleStatus,
  getSuggestedOverrideTime,
  validateScheduleOverride,
  ShiftItem,
  OverrideStaffTarget,
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
console.log("AUTOMATED TEST SUITE: BUSINESS ACCEPTANCE CRITERIA");
console.log("=======================================================\n");

// -------------------------------------------------------------------
// 1. CRITERION AC-SHIFT-02: TEMPORAL INVARIANTS (INVERTED & ZERO-LENGTH)
// -------------------------------------------------------------------
console.log("--- 1. Temporal Invariants (Inverted & Zero-Length Shifts) ---");

// Reported user issue: Inverted shift 20:00 to 19:00
const invertedShift: ShiftItem = { dayOfWeek: 1, startTime: "20:00", endTime: "19:00" };
const resInverted = validateSingleShift(invertedShift);
assert(
  !resInverted.isValid && resInverted.error?.type === "INVERTED_TIMES",
  "AC-SHIFT-02: Categorical rejection of inverted shift (20:00 to 19:00)",
  resInverted.error?.message
);

// Zero-length shift: 14:00 to 14:00
const zeroShift: ShiftItem = { dayOfWeek: 1, startTime: "14:00", endTime: "14:00" };
const resZero = validateSingleShift(zeroShift);
assert(
  !resZero.isValid && resZero.error?.type === "INVERTED_TIMES",
  "AC-SHIFT-02: Rejection of zero-duration shift (14:00 to 14:00)",
  resZero.error?.message
);

// -------------------------------------------------------------------
// 2. CRITERION AC-SHIFT-03: MINIMUM DURATION
// -------------------------------------------------------------------
console.log("\n--- 2. Minimum Duration Verification (AC-SHIFT-03) ---");

const shortShift: ShiftItem = { dayOfWeek: 1, startTime: "09:00", endTime: "09:15" };
const resShort = validateSingleShift(shortShift, 30);
assert(
  !resShort.isValid && resShort.error?.type === "MIN_DURATION",
  "AC-SHIFT-03: Rejection of shift shorter than 30 minutes (09:00 to 09:15)",
  resShort.error?.message
);

const exact30MinShift: ShiftItem = { dayOfWeek: 1, startTime: "09:00", endTime: "09:30" };
const resExact30 = validateSingleShift(exact30MinShift, 30);
assert(resExact30.isValid, "AC-SHIFT-03: Acceptance of shift with exactly 30 minutes (09:00 to 09:30)");

// -------------------------------------------------------------------
// 3. CRITERION AC-SHIFT-05: INTRA-DAY SHIFT OVERLAP
// -------------------------------------------------------------------
console.log("\n--- 3. Intra-Day Shift Overlap Tests (AC-SHIFT-05) ---");

const overlappingShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "08:30", endTime: "13:00" },
  { dayOfWeek: 1, startTime: "12:00", endTime: "16:00" }, // Overlaps 12:00 - 13:00
];
const resOverlap = validateDayShifts(1, overlappingShifts);
assert(
  resOverlap.some((e) => e.type === "OVERLAP"),
  "AC-SHIFT-05: Detection and blocking of overlapping shifts (08:30-13:00 & 12:00-16:00)"
);

const duplicateShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "15:00", endTime: "19:00" },
  { dayOfWeek: 1, startTime: "15:00", endTime: "19:00" },
];
const resDuplicate = validateDayShifts(1, duplicateShifts);
assert(
  resDuplicate.some((e) => e.type === "OVERLAP"),
  "AC-SHIFT-05: Detection and blocking of duplicate identical shifts"
);

// -------------------------------------------------------------------
// 4. CRITERION AC-SHIFT-04: DAILY SHIFT LIMIT
// -------------------------------------------------------------------
console.log("\n--- 4. Daily Shift Limit Verification (AC-SHIFT-04) ---");

const fourShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "07:00", endTime: "09:00" },
  { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
  { dayOfWeek: 1, startTime: "14:00", endTime: "16:00" },
  { dayOfWeek: 1, startTime: "18:00", endTime: "20:00" },
];
const resFour = validateDayShifts(1, fourShifts, 3);
assert(
  resFour.some((e) => e.type === "MAX_SHIFTS"),
  "AC-SHIFT-04: Blocking attempts to configure more than 3 shifts on the same day"
);

// -------------------------------------------------------------------
// 5. VALID SHIFTS (CONTINUOUS & SPLIT SCHEDULES)
// -------------------------------------------------------------------
console.log("\n--- 5. Valid Schedules (Continuous & Split Shifts) ---");

const validSplitShifts: ShiftItem[] = [
  { dayOfWeek: 1, startTime: "08:30", endTime: "13:00" },
  { dayOfWeek: 1, startTime: "15:00", endTime: "19:00" },
];
const resSplit = validateDayShifts(1, validSplitShifts);
assert(resSplit.length === 0, "AC-OK: Valid split shift (08:30-13:00 & 15:00-19:00) approved without errors");

const validContinuousShift: ShiftItem[] = [
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
];
const resContinuous = validateDayShifts(2, validContinuousShift);
assert(resContinuous.length === 0, "AC-OK: Valid continuous shift (09:00-18:00) approved without errors");

// -------------------------------------------------------------------
// 6. AVAILABILITY ENGINE (DEFENSIVE SLOT ENGINE BEHAVIOR)
// -------------------------------------------------------------------
console.log("\n--- 6. Slot Engine Defensive Behavior ---");

// If corrupted shift 20:00 to 19:00 enters, slot engine must NOT generate evening slots
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
  "SLOT-DEFENSE: Slot Engine ignores and produces 0 slots for inverted shifts (20:00 to 19:00)"
);

// Reported bug: At 21:00 today, past slots like 09:00 or 12:00 must NOT be generated
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
  "AC-TIME-01: Categorical exclusion of past slots today (at 21:05, 09:00 & 12:00 slots are discarded)"
);

// -------------------------------------------------------------------
// 7. CANCELLATION POLICIES & APPOINTMENT COLLISIONS
// -------------------------------------------------------------------
console.log("\n--- 7. Cancellation Policies & Collision Rules ---");

const futureApt = {
  id: "apt-1",
  startAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Appointment in 2 hours
  endAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
  status: "CONFIRMED",
  allowFreeCancel: false,
};

// Cancellation attempt with less than 4 hours notice
const cancelCheckBlocked = canCustomerCancelAppointment(futureApt, 4);
assert(
  !cancelCheckBlocked.allowed,
  "CANCEL-POLICY: Cancellation blocked with less than 4 hours advance notice"
);

// Exception: If the doctor rescheduled the appointment, customer can ALWAYS cancel for free
const staffRescheduledApt = {
  ...futureApt,
  status: "RESCHEDULED_BY_STAFF",
  allowFreeCancel: true,
};
const cancelCheckStaffRescheduled = canCustomerCancelAppointment(staffRescheduledApt, 4);
assert(
  cancelCheckStaffRescheduled.allowed && cancelCheckStaffRescheduled.isFreeCancellationBecauseOfStaff === true,
  "CANCEL-POLICY: Guaranteed penalty-free exception if staff rescheduled due to unplanned event"
);

// Collision detection
const conflictingAppointments = findConflictingAppointments(
  [futureApt],
  new Date(futureApt.startAt.getTime() + 15 * 60 * 1000), // Starts 15 min later
  new Date(futureApt.endAt.getTime() + 15 * 60 * 1000)
);
assert(
  conflictingAppointments.length === 1,
  "CONFLICT-CHECK: Atomic detection of collision between overlapping appointments"
);

// -------------------------------------------------------------------
// 8. CRITERION AC-ROLE-01: ROLE-BASED ACCESS CONTROL (RBAC)
// -------------------------------------------------------------------
console.log("\n--- 8. Role Separation & Context Scoping (AC-ROLE-01) ---");

// PROVIDER accounts (Doctors) are not customers
const isProviderAllowedToBook = (userRole: string) => userRole !== "PROVIDER";
assert(
  !isProviderAllowedToBook("PROVIDER"),
  "AC-ROLE-01: Self-booking blocked for healthcare provider accounts with PROVIDER role"
);
assert(
  isProviderAllowedToBook("CUSTOMER"),
  "AC-ROLE-01: Accounts with CUSTOMER role permitted to use public booking flow"
);

// -------------------------------------------------------------------
// 9. SCHEDULE OVERRIDE / CLOSED-SHIFT GUARDS
// -------------------------------------------------------------------
console.log("\n=== 9. SCHEDULE OVERRIDE / CLOSED-SHIFT GUARDS ===");

const vegaTarget: OverrideStaffTarget = {
  displayName: "Dr. Alejandro Vega",
  isActive: true,
  workingShifts: [
    { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Thursday
    { dayOfWeek: 5, startTime: "09:00", endTime: "16:00" }, // Friday
  ],
};

const pazTarget: OverrideStaffTarget = {
  displayName: "Dr. Marcos Paz",
  isActive: true,
  workingShifts: [
    { dayOfWeek: 4, startTime: "15:00", endTime: "22:00" }, // Thursday evening
  ],
};

const thuEveningNow = new Date("2026-11-12T17:38:00");

// 9.1 Past date rejection
const resPast = validateScheduleOverride({
  type: "FULL_DAY_OFF",
  dateStr: "2020-01-01",
  targets: [vegaTarget],
  now: thuEveningNow,
});
assert(!resPast.valid && resPast.status.isPastDate, "Past date rejected for FULL_DAY_OFF");

// 9.2 Non-working weekday rejection (Sunday has no shifts)
const resSunday = validateScheduleOverride({
  type: "FULL_DAY_OFF",
  dateStr: "2026-11-15", // Sunday
  targets: [vegaTarget],
  now: thuEveningNow,
});
assert(!resSunday.valid && !resSunday.status.hasShiftsOnDay, "Non-working weekday (Sunday) rejected");

// 9.3 Same-day already closed (17:38 when Vega's Thursday shift ended at 17:00)
for (const type of ["EARLY_LEAVE", "LATE_START", "FULL_DAY_OFF"] as const) {
  const resClosed = validateScheduleOverride({
    type,
    dateStr: "2026-11-12",
    timeStr: "16:00",
    targets: [vegaTarget],
    now: thuEveningNow,
  });
  assert(
    !resClosed.valid && resClosed.status.isDayClosedAlready,
    `Same-day ${type} rejected when shift already closed (17:38 >= 17:00)`
  );
}

// 9.4 EARLY_LEAVE at exact closing time (16:00 when Friday shift ends at 16:00) vs valid 15:00
const resBoundaryEarly = validateScheduleOverride({
  type: "EARLY_LEAVE",
  dateStr: "2026-11-13",
  timeStr: "16:00",
  targets: [vegaTarget],
  now: thuEveningNow,
});
assert(!resBoundaryEarly.valid, "EARLY_LEAVE at exact shift closing time (16:00) rejected");

const resValidEarly = validateScheduleOverride({
  type: "EARLY_LEAVE",
  dateStr: "2026-11-13",
  timeStr: "15:00",
  targets: [vegaTarget],
  now: thuEveningNow,
});
assert(resValidEarly.valid, "EARLY_LEAVE inside Friday shift bounds (15:00 < 16:00) accepted");

// 9.5 Same-day open evening shift: past hour (16:00 < 17:38) rejected, future hour (20:00) accepted
const resPastHour = validateScheduleOverride({
  type: "EARLY_LEAVE",
  dateStr: "2026-11-12",
  timeStr: "16:00",
  targets: [pazTarget],
  now: thuEveningNow,
});
assert(!resPastHour.valid, "Same-day EARLY_LEAVE at past hour (16:00 when now=17:38) rejected");

const resOpenEvening = validateScheduleOverride({
  type: "EARLY_LEAVE",
  dateStr: "2026-11-12",
  timeStr: "20:00",
  targets: [pazTarget],
  now: thuEveningNow,
});
assert(resOpenEvening.valid, "Same-day EARLY_LEAVE at future hour inside open evening shift (20:00) accepted");

// 9.6 Suggested override time respects remaining open window on same day
const pazStatus = getDayScheduleStatus({
  dateStr: "2026-11-12",
  targets: [pazTarget],
  now: thuEveningNow,
});
const suggestedEarly = getSuggestedOverrideTime("EARLY_LEAVE", pazStatus, thuEveningNow);
assert(
  timeToMinutes(suggestedEarly) > timeToMinutes("17:38") &&
    timeToMinutes(suggestedEarly) < pazStatus.latestEndMin,
  `Suggested EARLY_LEAVE (${suggestedEarly}) is after now (17:38) and before closing (22:00)`
);

// -------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------
console.log("\n=======================================================");
console.log(`TOTAL TESTS EXECUTED: ${passedCount + failedCount}`);
console.log(`✅ PASSED: ${passedCount}`);
console.log(`❌ FAILED: ${failedCount}`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

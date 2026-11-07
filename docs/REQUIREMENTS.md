# 📋 System Requirements Specification & Traceability Matrix

This document defines the **Functional Requirements (FR)**, **Non-Functional Requirements (NFR)**, and the **Audited Bug Traceability Matrix** for the booking system.

---

## 1. Functional Requirements (FR)

| ID | Domain | Description | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **FR-01** | Catalog | Expose public service catalog with pricing, durations in minutes, and buffer times. | Loads in < 1s without requiring prior authentication. |
| **FR-02** | Availability | Calculate open booking slots in 30-min increments, excluding past hours and respecting lead time. | Current day never displays slots for past hours. |
| **FR-03** | Auto-Assign | Allow customers to select "Any Available Staff" (`ANY`) for automatic load balancing. | Assigns the first available specialist without collision. |
| **FR-04** | Atomic Booking | Confirm bookings with customer name, required phone number, email, and encrypted password. | Prevents race condition collisions and displays confirmation. |
| **FR-05** | Anti-Hoarding | Restrict customers to a maximum of 2 active concurrent upcoming bookings. | Rejects third booking attempt with clear explanatory notice. |
| **FR-06** | RBAC Scopes | Provide distinct roles: `CUSTOMER` (patient), `PROVIDER` (staff/doctor), and `ADMIN` (owner). | `PROVIDER` accounts cannot book appointments as customers in `/`. |
| **FR-07** | Weekly Shifts | Allow administrators to configure continuous or split working shifts per day of week. | Enforces $T_{end} > T_{start}$ and minimum 30-min duration. |
| **FR-08** | 1-Touch Overrides | Provide quick schedule blocks: "Late Arrival", "Early Departure", and "Close Day". | Creates `TimeOff` record and immediately disables public slots. |
| **FR-09** | Reopen Schedule | Allow administrators to remove a schedule override and restore open slots. | Working slots immediately become bookable again. |
| **FR-10** | Flexible Cancel | Customers can cancel bookings with at least 6 hours of advance notice. | If staff modified the appointment, cancellation is penalty-free. |
| **FR-11** | Anti-Troll Control | Record unexcused absences (`NO_SHOW`) and lock the account on the 2nd strike. | Blocked customers cannot book online and must contact clinic. |
| **FR-12** | White-Label | Allow business owners to customize branding, logo, colors, and staff label. | Dynamically adapts "Doctor(a)", "Barber", "Stylist", etc. |

---

## 2. Non-Functional Requirements (NFR)

1. **NFR-01 Performance:** The `/api/availability` endpoint must resolve bookable slots in under 100ms across 7-day calendar horizons.
2. **NFR-02 Responsiveness:** Adaptive mobile-first layout built with Tailwind CSS 4, rendering cleanly on mobile screens (375px+) as well as widescreen desktops (1280px+).
3. **NFR-03 Security:** Password hashing using `bcrypt` (10 salt rounds), secure HttpOnly session cookies, and strict privilege escalation prevention.
4. **NFR-04 Timezone Independence:** Eliminates UTC midnight drift bugs through pure local date arithmetic (`formatLocalDateYYYYMMDD`).
5. **NFR-05 Progressive Web App (PWA):** Compliant `manifest.webmanifest` and Service Worker registration enabling native installation on iOS and Android.
6. **NFR-06 Defensive Validation:** Redundant validation on both client (React forms) and server (Next.js route handlers). Zero reliance on blocking native dialogs (`window.alert` / `window.confirm`).

---

## 3. Audited Bug Traceability Matrix

| Bug ID | Root Cause | Implemented Resolution | Status |
| :--- | :--- | :--- | :---: |
| **BUG-01** | Past appointment slots were shown on "TODAY" late in the evening. | Enforced local `new Date()` + `minLeadTimeMinutes` filtering in `slot-engine.ts`. | ✅ Resolved |
| **BUG-02** | "Today" button displayed tomorrow's date due to UTC ISO conversion. | Replaced `toISOString()` with local date formatting `formatLocalDateYYYYMMDD`. | ✅ Resolved |
| **BUG-03** | Full day closure offered moving affected appointments to 23:59:59. | Strictly disallowed `MOVE_TO_END` resolution strategy for `FULL_DAY_OFF`. | ✅ Resolved |
| **BUG-04** | Closed-day schedule overrides lacked an unblock/reopen action. | Added interactive `TimeOff` card with `🔓 Reopen schedule / Remove block` button. | ✅ Resolved |
| **BUG-05** | Past appointments accordion was hidden when `activeApts.length === 0`. | Decoupled history drawer rendering condition in `ClientApp.tsx`. | ✅ Resolved |
| **BUG-06** | Shift form permitted inverted time inputs (e.g., 20:00 to 19:00). | Added inline validation error and HTTP 400 rejection in `/api/admin/shifts`. | ✅ Resolved |
| **BUG-07** | Role inconsistency: Doctors could self-book appointments as patients. | Enforced RBAC invariant: Automatic redirect of `PROVIDER` accounts to `/admin`. | ✅ Resolved |
| **BUG-08** | Service catalog lacked an in-place editing modal for price and duration. | Added `✏️ Edit` button on each service card with pre-populated reactive modal. | ✅ Resolved |
| **BUG-09** | Date pill badge counted clinic-wide appointments instead of selected doctor. | Updated pill count query to filter by selected specialist + "Whole team" mode. | ✅ Resolved |

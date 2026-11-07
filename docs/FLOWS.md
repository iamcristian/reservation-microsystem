# 🔄 System Sequence Diagrams & Operational Flows

This document details the core operational and transactional workflows of the system modeled using **Mermaid Sequence Diagrams**.

---

## 1. Availability Calculation Flow (`Slot Engine`)

Describes how the slot engine evaluates weekly working shifts, schedule overrides, and existing appointments to compute purely valid, non-colliding bookable slots.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 Customer (Web/PWA)
    participant UI as 🖥️ ClientApp (React)
    participant API as 🚀 /api/availability
    participant Engine as ⚙️ Slot Engine
    participant DB as 💾 Database (Prisma)

    Customer->>UI: Selects Service and Date
    UI->>API: GET /api/availability?serviceId=X&date=YYYY-MM-DD
    API->>DB: Fetch WorkingShifts for day of week
    API->>DB: Fetch active TimeOffs for date
    API->>DB: Fetch confirmed Appointments for date
    DB-->>API: Consolidated operational data
    
    API->>Engine: computeAvailableSlots(date, shifts, timeOffs, appointments)
    loop For each candidate slot (30-min intervals)
        Engine->>Engine: Is slot within working shift hours?
        Engine->>Engine: Is slot in the future (> now + leadTime)?
        Engine->>Engine: Does slot collide with an active TimeOff override?
        Engine->>Engine: Does slot collide with an existing appointment?
    end
    Engine-->>API: Array of available slots (e.g. ["09:00", "09:30", "11:00"])
    API-->>UI: HTTP 200 { date, slots: [...] }
    UI-->>Customer: Renders interactive slot buttons
```

---

## 2. Atomic Booking Flow with Balanced Assignment (`staffId="ANY"`)

Shows how the system resolves specialist assignment when the customer selects "Any Available Staff".

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 Customer
    participant UI as 🖥️ ClientApp
    participant API as 🚀 /api/appointments
    participant DB as 💾 Database

    Customer->>UI: Chooses time slot and fills form (Name, Phone, Password)
    UI->>API: POST /api/appointments { staffId: "ANY", serviceId, date, time, ... }
    
    API->>DB: Check customer's active appointment count
    alt Active appointments >= 2
        API-->>UI: HTTP 429 "Maximum 2 active appointments allowed"
        UI-->>Customer: Displays inline alert preventing submission
    else Active appointments < 2
        API->>DB: Find active staff members qualified for this service
        API->>DB: Find first staff member with an open slot at this exact time
        alt No specialist available (race condition collision)
            API-->>UI: HTTP 409 Conflict "Slot no longer available"
            UI-->>Customer: Prompts to select another time slot
        else Staff member identified (e.g. Dra. Sofía Ríos)
            API->>DB: Atomically insert Appointment record (status: "CONFIRMED")
            API->>DB: Set secure session cookie
            DB-->>API: Created appointment record
            API-->>UI: HTTP 200 { appointment: { id, startAt, staff, ... } }
            UI-->>Customer: Displays Step 5 confirmation screen (Concentric Circles)
        end
    end
```

---

## 3. 1-Touch Unplanned Schedule Override Flow (`Close Day`)

Illustrates the full day closure procedure, collision detection, and instant unblocking/reopening.

```mermaid
sequenceDiagram
    autonumber
    actor Doctor as 🩺 Doctor / Admin
    participant UI as 🖥️ AdminApp
    participant API as 🚀 /api/admin/day-override
    participant DB as 💾 Database

    Doctor->>UI: Clicks "Cerrar día" on today's calendar
    UI->>Doctor: Opens modal to enter contextual reason
    Doctor->>UI: Types reason ("Medical Emergency") and confirms
    UI->>API: POST /api/admin/day-override { staffId, date, reason }
    
    API->>DB: Query appointments affected by this closure
    alt Conflicting appointments exist
        API-->>UI: Prompts resolution (Cancel affected appointments & notify)
        Doctor->>UI: Clicks "Cancelar citas afectadas"
        UI->>API: POST /api/admin/day-override { resolution: "CANCEL_ALL" }
        API->>DB: Set appointment statuses to "CANCELLED_BY_PROVIDER"
        API->>DB: Insert Notification records for affected customers
    end
    API->>DB: Insert TimeOff record (type: "FULL_DAY_OFF")
    DB-->>API: Override saved
    API-->>UI: HTTP 200 { success: true }
    UI-->>Doctor: Renders "Día cerrado" banner with "🔓 Reabrir horario" button

    opt Schedule Reopening / Unblocking
        Doctor->>UI: Clicks "Reabrir horario / Quitar bloqueo"
        UI->>API: DELETE /api/admin/day-override?staffId=X&date=YYYY-MM-DD
        API->>DB: Delete TimeOff record
        API-->>UI: HTTP 200 { success: true }
        UI-->>Doctor: Restores calendar and frees slots immediately
    end
```

---

## 4. Anti-Troll Control & Account Re-activation Flow (2-Strike System)

Details how unexcused absences trigger automated account locks and the subsequent administrator reset flow.

```mermaid
sequenceDiagram
    autonumber
    actor Doctor as 🩺 Doctor
    participant UI as 🖥️ AdminApp
    participant API as 🚀 /api/admin/appointments/[id]/status
    participant DB as 💾 Database
    actor Customer as 👤 Customer

    Doctor->>UI: Patient failed to show up -> Clicks "⚠️ No se presentó"
    UI->>API: PUT /api/admin/appointments/[id]/status { status: "NO_SHOW" }
    API->>DB: Update appointment status to "NO_SHOW"
    API->>DB: Increment customer's noShowCount by 1
    
    alt noShowCount >= 2
        API->>DB: Set customer isBlocked = true
        DB-->>API: Account locked
    end
    API-->>UI: Status updated

    opt Blocked Customer attempts to book
        Customer->>API: POST /api/appointments
        API-->>Customer: HTTP 403 Forbidden ("Account locked due to absences")
    end

    opt Administrator manually unlocks customer
        Doctor->>UI: Navigates to "Clientes" tab -> Clicks "Desbloquear"
        UI->>API: PUT /api/admin/users/[id]/toggle-block
        API->>DB: Reset noShowCount = 0 and isBlocked = false
        API->>DB: Archive previous no-shows (status = "NO_SHOW_ARCHIVED")
        API-->>UI: HTTP 200 { customer: { isBlocked: false } }
        UI-->>Doctor: Customer badge updated to "Activo (0 faltas)"
    end
```

# 🗄️ Database Architecture & Entity Dictionary

This document details the relational data model, entity schemas, constraints, indexes, and cloud migration procedures implemented with **Prisma ORM**.

---

## 1. Entity-Relationship Diagram (Mermaid ERD)

```mermaid
erDiagram
    BusinessSettings ||--o{ StaffProfile : "configures"
    User ||--o| StaffProfile : "has staff profile"
    User ||--o{ Appointment : "books as customer"
    User ||--o{ Notification : "receives"
    
    StaffProfile ||--o{ StaffService : "offers"
    StaffProfile ||--o{ WorkingShift : "works on"
    StaffProfile ||--o{ TimeOff : "registers time off"
    StaffProfile ||--o{ Appointment : "conducts"
    
    Service ||--o{ StaffService : "assigned to"
    Service ||--o{ Appointment : "is booked in"

    BusinessSettings {
        int id PK
        string name
        string tagline
        string addressText
        string googleMapsUrl
        string phoneWhatsapp
        string currencySymbol
        string staffLabel
        int slotStepMin
        int bookingHorizonDays
        int minLeadTimeMinutes
        int maxActiveBookings
        int minCancelNoticeHours
        string themePrimaryHex
        string themeSurfaceHex
    }

    User {
        string id PK
        string googleId UK
        string email UK
        string passwordHash
        string name
        string phone
        string role
        boolean isBlocked
        int noShowCount
        int completedCount
        string adminNotes
        datetime createdAt
    }

    StaffProfile {
        string id PK
        string userId FK
        string displayName
        string titleRole
        string phoneWhatsapp
        string avatarUrl
        int orderIndex
        boolean isActive
        int customHorizonDays
        int customLeadTimeMin
    }

    Service {
        string id PK
        string name
        string description
        int durationMin
        int bufferAfterMin
        float price
        int orderIndex
        boolean isActive
    }

    WorkingShift {
        string id PK
        string staffId FK
        int dayOfWeek
        string startTime
        string endTime
    }

    TimeOff {
        string id PK
        string staffId FK
        datetime startAt
        datetime endAt
        string type
        string reason
    }

    Appointment {
        string id PK
        string serviceId FK
        string staffId FK
        string customerId FK
        datetime startAt
        datetime endAt
        string status
        boolean allowFreeCancel
        string staffMoveReason
        string customerNotes
    }

    Notification {
        string id PK
        string userId FK
        string appointmentId FK
        string type
        string title
        string message
        boolean isRead
        datetime createdAt
    }
```

---

## 2. Comprehensive Data Dictionary

### `BusinessSettings` (Global Business & White-Label Configuration)
Stores the clinic or business profile, brand appearance, and operational booking parameters.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | Primary Key (`@default(1)`) | Singleton configuration identifier |
| `name` | `String` | Required | Commercial name of the business |
| `tagline` | `String?` | Optional | Slogan, specialty, or branch description |
| `addressText` | `String?` | Optional | Street address displayed on customer receipts |
| `googleMapsUrl`| `String?` | Optional | Direct link to Google Maps / Directions |
| `phoneWhatsapp`| `String?` | Optional | Official clinic WhatsApp number for notifications |
| `currencySymbol`| `String` | Default: `"$"` | Display currency symbol (`$`, `Bs`, `€`, `S/.`, etc.) |
| `staffLabel` | `String` | Default: `"Doctor(a)"` | Dynamic role terminology ("Doctor", "Barbero", etc.) |
| `slotStepMin` | `Int` | Default: `30` | Interval step between generated bookable slots (in minutes) |
| `bookingHorizonDays` | `Int` | Default: `7` | Maximum number of days into the future customers can book |
| `minLeadTimeMinutes` | `Int` | Default: `30` | Minimum advance notice required before a slot start time |
| `maxActiveBookings` | `Int` | Default: `2` | Anti-hoarding limit: maximum active upcoming bookings per customer |
| `minCancelNoticeHours` | `Int` | Default: `4` | Hours of advance notice required for standard cancellation |

---

### `User` (Identity, Authentication & RBAC)
Represents all system actors: patients/customers, healthcare providers/specialists, and business administrators.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Primary Key (`cuid`) | Unique user identifier |
| `googleId` | `String?` | Unique | Google OAuth subject ID for passwordless login |
| `email` | `String` | Unique, Required | Primary email address |
| `passwordHash` | `String?` | Optional | Bcrypt hashed password for email/password authentication |
| `name` | `String` | Required | Full personal or legal name |
| `phone` | `String?` | Optional | Contact phone number for WhatsApp confirmations |
| `role` | `String` | Default: `"CUSTOMER"` | RBAC role: `"ADMIN"`, `"PROVIDER"`, or `"CUSTOMER"` |
| `isBlocked` | `Boolean` | Default: `false` | Anti-troll flag: true if account is locked due to absences |
| `noShowCount` | `Int` | Default: `0` | Active strike count: unexcused absences recorded |
| `completedCount` | `Int` | Default: `0` | Total successfully attended appointments |
| `adminNotes` | `String?` | Optional | Private administrative notes and observations |

---

### `StaffProfile` (Healthcare Provider / Specialist Profile)
Maintains professional credentials, custom booking horizons, and personal contact details for team members.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Primary Key (`cuid`) | Unique staff profile identifier |
| `userId` | `String` | Unique, Foreign Key | Link to authentication account in `User` |
| `displayName` | `String` | Required | Professional title and name (e.g., "Dr. Alejandro Vega") |
| `titleRole` | `String` | Required | Specialty or role description (e.g., "Ortodoncia") |
| `phoneWhatsapp` | `String?`| Optional | Specialist direct phone number |
| `avatarUrl` | `String?` | Optional | Profile image URL |
| `orderIndex` | `Int` | Default: `0` | UI sort display order in catalog views |
| `isActive` | `Boolean` | Default: `true` | Active switch: if false, hidden from public booking |
| `customHorizonDays` | `Int?` | Optional | Custom booking horizon override for this specialist |
| `customLeadTimeMin` | `Int?` | Optional | Custom minimum lead time override for this specialist |

---

### `WorkingShift` (Weekly Working Hours)
Defines repeating weekly shift blocks for each specialist.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Primary Key (`cuid`) | Unique shift identifier |
| `staffId` | `String` | Foreign Key (`StaffProfile`) | Reference to the specialist |
| `dayOfWeek` | `Int` | `0` to `6` | Day of week (`0` = Sunday, `1` = Monday, ..., `6` = Saturday) |
| `startTime` | `String` | Format: `"HH:mm"` | Shift start time in 24-hour format |
| `endTime` | `String` | Format: `"HH:mm"` | Shift end time in 24-hour format |

> **Validation Invariant:** Enforces `startTime < endTime` with a minimum duration of 30 minutes, maximum 3 shifts per day, and zero intra-day overlaps.

---

### `TimeOff` (Schedule Overrides & Unplanned Events)
Stores explicit time blocks during which a specialist cannot attend appointments.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Primary Key (`cuid`) | Unique override identifier |
| `staffId` | `String` | Foreign Key (`StaffProfile`) | Reference to specialist |
| `startAt` | `DateTime` | Required | Start timestamp of the unavailable period |
| `endAt` | `DateTime` | Required | End timestamp of the unavailable period |
| `type` | `String` | Default: `"UNPLANNED"` | Override category: `"LATE_START"`, `"EARLY_LEAVE"`, `"FULL_DAY_OFF"` |
| `reason` | `String?` | Optional | Contextual reason for record keeping and patient notice |

---

### `Appointment` (Booking Records)
Core operational table recording scheduled consultations and customer visits.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Primary Key (`cuid`) | Unique appointment identifier |
| `serviceId` | `String` | Foreign Key (`Service`) | Selected medical or commercial service |
| `staffId` | `String` | Foreign Key (`StaffProfile`) | Assigned specialist |
| `customerId` | `String` | Foreign Key (`User`) | Booking patient or customer |
| `startAt` | `DateTime` | Required | Appointment scheduled start timestamp |
| `endAt` | `DateTime` | Required | Appointment scheduled end timestamp (includes buffer) |
| `status` | `String` | Default: `"CONFIRMED"` | Lifecycle state: `"CONFIRMED"`, `"COMPLETED"`, `"CANCELLED"`, `"CANCELLED_BY_PROVIDER"`, `"NO_SHOW"`, `"NO_SHOW_ARCHIVED"` |
| `allowFreeCancel` | `Boolean` | Default: `false` | True if rescheduled by staff, granting unrestricted customer cancellation |
| `staffMoveReason` | `String?` | Optional | Reason recorded when modified by clinic staff |
| `customerNotes` | `String?` | Optional | Special instructions or clinical symptoms provided by patient |

---

## 3. Database Indexes & Query Optimizations

To guarantee sub-15ms response times across the availability calculation engine, the following composite indexes are applied:

1. **`WorkingShift [staffId, dayOfWeek]`**: Accelerates retrieving daily working hours when populating slot calendars.
2. **`Appointment [staffId, startAt, status]`**: Quickly retrieves active bookings in a given time window to eliminate occupied slots.
3. **`TimeOff [staffId, startAt, endAt]`**: Optimizes boundary overlap checks for single-day or partial-day closures.
4. **`Appointment [customerId, startAt, status]`**: Enables instant computation of the customer's active booking count for anti-hoarding limits.

---

## 4. Production Cloud Migration Guide

The Prisma schema is fully database-agnostic. While local development uses SQLite (`file:./dev.db`), production environments utilize high-availability PostgreSQL clusters.

### Step-by-Step Migration (Neon.tech or Supabase):

1. **Provision Database Cluster:**
   Create a new PostgreSQL project on [Neon](https://neon.tech) or [Supabase](https://supabase.com) with SSL enforcement enabled.
2. **Update Datasource Provider in `prisma/schema.prisma`:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. **Configure Environment Variable in Hosting Provider:**
   Set `DATABASE_URL` in your Vercel or cloud host environment dashboard:
   ```
   DATABASE_URL="postgres://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
4. **Push Schema to Production Cluster:**
   ```bash
   pnpm prisma db push
   pnpm tsx prisma/seed.ts
   ```

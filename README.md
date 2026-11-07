# 🌟 Reservas App — Multi-Staff Appointment Scheduling & Booking Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma)](https://www.prisma.io/)
[![Playwright](https://img.shields.io/badge/Playwright-32%2F32%20Pass%20(100%25)-green?logo=playwright)](https://playwright.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A production-grade, modular, white-label appointment management and online booking platform designed for multi-professional businesses. Built with a decoupled architecture to seamlessly adapt with one click to **Dental & Medical Clinics, Barbershops, Hair Salons, Spas, Tattoo Studios, and Fitness Centers**.

---

## 📸 System Showcase & Visual Gallery

| 1. Public Portal & Service Catalog (Desktop & Mobile) | 2. Real-Time Slot Picker & Availability Engine |
| :---: | :---: |
| ![Public Catalog](docs/screenshots/01-portal-cliente-catalogo.png) | ![Slot Picker](docs/screenshots/02-seleccion-horarios-slots.png) |
| **3. Atomic Booking Confirmation & Concentric Circles** | **4. Team Management & Granular RBAC Permissions** |
| ![Booking Confirmation](docs/screenshots/03-confirmacion-cita-qr.png) | ![Team Management](docs/screenshots/04-admin-equipo-permisos.png) |
| **5. Daily Calendar & 1-Touch Schedule Overrides** | **6. Weekly Shifts & Business Hours Configuration** |
| ![Daily Calendar](docs/screenshots/05-admin-agenda-imprevistos.png) | ![Weekly Shifts](docs/screenshots/06-admin-configuracion-horarios.png) |

---

## ⚡ Core Capabilities & Business Logic

### 👤 Customer Booking Portal (Front-Office)
- **Frictionless 4-Step Booking Wizard:** Service selection $\to$ Staff member selection $\to$ Date & slot selection $\to$ Customer identification and confirmation.
- **Intelligent Staff Auto-Assignment (`ANY`):** Load-balancing algorithm that dynamically assigns the appointment to the best available professional for the chosen time slot.
- **Self-Service "My Appointments" Hub:** Direct view of active, rescheduled, and past bookings with an expandable **Past Appointments & Archive** drawer.
- **Instant WhatsApp Deep-Links:** One-tap integration to `https://wa.me/` with pre-filled localized text containing appointment date, time, service name, and clinic details.
- **Progressive Web App (PWA):** Fully installable as a native app on Android, iOS, and Desktop with `manifest.webmanifest`, app icons, and offline shell caching.

### 🛡️ Administrative & Operations Management Hub (`/admin`)
- **Role-Based Access Control (RBAC):**
  - `👑 ADMIN / PRIMARY OWNER`: Full control over clinic profile, logo, location map, pricing catalog, scheduling rules, and staff authorization.
  - `🩺 PROVIDER (Doctor / Barber / Specialist)`: Strictly isolated view restricted to their own appointments, attendances, and personal schedule overrides. Role invariant: blocked from self-booking appointments as a patient.
- **1-Touch Unplanned Schedule Overrides:**
  - *Late arrival today* (shift start time delayed).
  - *Early departure / Event* (shift end time curtailed).
  - *Close full day* (day blocked off with automated notification to affected clients).
  - *Reopen schedule*: immediate one-click restore button to clear day blocks and re-enable slots.
- **Multi-Staff Calendar Filter & `"👥 Whole Team"` View:** Switch between individual specialist views or inspect the clinic's consolidated daily schedule.
- **Anti-Hoarding Safeguards:** Enforces a configurable cap of maximum **2 active upcoming bookings per customer**.
- **Anti-Troll & No-Show Protection (2-Strike System):** Automatically locks a customer's account from creating new web bookings if they accumulate 2 recorded unexcused absences (`NO_SHOW`).
- **Dynamic White-Label Customization:** Customize brand name, staff terminology (`staffLabel`: "Doctor", "Barbero", "Terapeuta", etc.), currency symbol, cancellation policies, and lead times.

---

## 🏗️ System Architecture & Technology Stack

```
reservas-app/
├── docs/                       # Technical architecture documentation & C4 models
│   ├── ARCHITECTURE.md         # C4 System Context, Container, Component & Deployment diagrams
│   ├── DATABASE.md             # Relational data schema, entity dictionary & migration guides
│   ├── REQUIREMENTS.md         # Functional, non-functional requirements & traceability matrix
│   ├── FLOWS.md                # Sequence diagrams for booking, slot calculation & overrides
│   └── screenshots/            # Curated high-resolution portfolio screenshots
├── src/
│   ├── app/                    # Next.js App Router (Pages & REST Endpoints)
│   │   ├── api/                # API routes (/availability, /appointments, /admin/*, /auth/*)
│   │   ├── admin/              # Role-protected administration dashboard
│   │   └── page.tsx            # Public customer booking wizard
│   ├── components/             # Reusable interactive React components (Tailwind CSS 4)
│   │   ├── ClientApp.tsx       # 4-step wizard, appointment cards & PWA banner
│   │   ├── AdminApp.tsx        # Calendar dashboard, shifts editor & staff manager
│   │   └── BranchMap.tsx       # Interactive Leaflet/OpenStreetMap branch modal
│   └── lib/                    # Pure, decoupled business logic engines
│       ├── slot-engine.ts      # Slot computation, past hour filtering & lead time rules
│       ├── booking-rules.ts    # Temporal invariants, collision checks & cancellation logic
│       ├── session.ts          # Secure HttpOnly session cookie utilities
│       └── prisma.ts           # Typed Prisma ORM singleton client
├── prisma/
│   ├── schema.prisma           # Database-agnostic relational schema (SQLite / PostgreSQL)
│   └── seed.ts                 # Realistic initial seed data for immediate evaluation
└── tests/                      # Comprehensive automated test pyramid
    ├── acceptance-criteria.test.ts # 16 unit tests for temporal invariants & shifts
    ├── e2e-full-system.test.ts     # 37 full-stack API & database integration tests
    └── playwright-suite.ts         # 32 end-to-end browser steps executed in real Chromium
```

---

## 🚀 Quick Start (Local Development)

### 1. Clone the repository and install dependencies
```bash
git clone https://github.com/your-username/reservas-app.git
cd reservas-app
pnpm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```

### 3. Initialize database and load seed data
```bash
pnpm prisma db push
pnpm tsx prisma/seed.ts
```

### 4. Start development server
```bash
pnpm dev
```
Open your browser at:
- **Customer Booking Portal:** `http://localhost:3000`
- **Management & Admin Dashboard:** `http://localhost:3000/admin`

---

## 🔐 Pre-configured Test Accounts (Seed)

| Role | Name | Email (`email`) | Password | Scope & Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Admin / Owner** | Dr. Alejandro Vega | `alejandro@sonrisa.com` | `Admin123!` | Full administrative access to settings, staff, and agenda |
| **Doctor (Staff)** | Dra. Sofía Ríos | `sofia@sonrisa.com` | `Doctor123!` | Orthodontics specialist • Personal schedule & overrides |
| **Doctor (Staff)** | Dr. Marcos Paz | `marcos@sonrisa.com` | `Doctor123!` | Endodontics & emergency shifts • Personal schedule |
| **Customer / Patient** | Carlos Mendoza | `carlos@ejemplo.com` | `123456` | Public booking wizard & appointment history |

---

## 🧪 Automated Testing & Code Quality

The codebase enforces a rigorous test pyramid covering mathematical time invariants, database integrity, and end-to-end browser automation:

```bash
# 1. Unit tests for temporal invariants & shifts (16/16 PASS)
pnpm test

# 2. Full-stack API & database integration tests (37/37 PASS)
pnpm test:e2e

# 3. Real Chromium browser automation with Playwright (32/32 PASS)
pnpm tsx tests/playwright-suite.ts

# 4. Production build verification with Next.js Turbopack
pnpm build
```

---

## 📚 Technical Architecture Documentation

- [🏛️ System Architecture & C4 Models (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
- [🗄️ Database Schema & Entity Dictionary (`docs/DATABASE.md`)](docs/DATABASE.md)
- [📋 System Requirements & Traceability Matrix (`docs/REQUIREMENTS.md`)](docs/REQUIREMENTS.md)
- [🔄 Core Business Logic Sequence Diagrams (`docs/FLOWS.md`)](docs/FLOWS.md)

---

## 🌐 Production Deployment

### Cloud Database (Serverless PostgreSQL)
1. Provision a free PostgreSQL database on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
2. In `prisma/schema.prisma`, update the datasource provider from `"sqlite"` to `"postgresql"`.
3. Run `pnpm prisma db push` to synchronize the schema with your production cluster.

### Hosting on Vercel
1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Set the `DATABASE_URL` environment variable to your Neon/Supabase connection string.
3. In **Build Command**, configure: `pnpm prisma generate && next build`.
4. Your application will deploy with automated HTTPS, global edge caching, and active PWA support!

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

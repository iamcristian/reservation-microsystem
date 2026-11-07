# 🏛️ System Architecture (C4 Models & Design Principles)

This document outlines the software architecture of **Sonrisa / Reservas App**, a high-concurrency multi-staff appointment booking and schedule management platform designed following the **C4 model** methodology.

---

## 1. Level 1: System Context Diagram

The System Context diagram illustrates how external actors (customers/patients, clinic providers/specialists, and business administrators) interact with the booking platform and integrated external third-party services (Google OAuth, WhatsApp, and Google Maps).

```mermaid
flowchart TD
    Customer["👤 Customer / Patient\n(Web Browser / Mobile PWA)"]
    Provider["🩺 Healthcare Provider / Specialist\n(Restricted /admin Portal)"]
    Admin["👑 Business Owner / Admin\n(Full /admin Portal)"]
    
    System["🏢 Reservas App Platform\n(Next.js Full-Stack Web Application)"]
    
    GoogleOAuth["🔐 Google OAuth 2.0\n(Staff identity & authentication)"]
    WhatsAppAPI["💬 WhatsApp Web / Mobile App\n(Direct client notices & reminders)"]
    GoogleMaps["🗺️ Google Maps API\n(Georeferenced branch location)"]

    Customer -->|"Browses catalog, selects slot, books appointment"| System
    Provider -->|"Manages personal agenda, marks attendances & blocks time-offs"| System
    Admin -->|"Full business control: branding, team, pricing & schedules"| System

    System -->|"Validates staff OAuth tokens & identities"| GoogleOAuth
    System -->|"Generates deep-linked wa.me chat URLs"| WhatsAppAPI
    System -->|"Provides interactive branch location & directions"| GoogleMaps
```

---

## 2. Level 2: Container Diagram

Describes the high-level executable software containers, network protocols, and persistence layers that comprise the running application.

```mermaid
flowchart LR
    Browser["🌐 User Web Browser\n(Chrome, Safari, Firefox, Edge)\nReact 19 SPA / PWA"]
    
    subgraph NextServer["🖥️ Application Server (Next.js 16 + Turbopack)"]
        EdgeRoutes["Public Route Handlers\n(/, /admin, manifest)"]
        APIRoutes["REST API Endpoints\n(/api/availability, /api/appointments,\n/api/admin/*, /api/auth/*)"]
        SlotEngine["⚙️ Slot Engine & Business Rules\n(Deterministic availability calculation & overlap guards)"]
        PrismaORM["⚡ Prisma ORM Client\n(Type-Safe Data Access Layer)"]
    end

    subgraph DataStore["💾 Persistence Layer"]
        DB[("Relational Database\nSQLite (Dev) / PostgreSQL (Neon/Supabase in Prod)")]
    end

    Browser -->|"HTTPS / JSON"| EdgeRoutes
    Browser -->|"Fetch API / REST JSON"| APIRoutes
    APIRoutes -->|"Queries available slots & rules"| SlotEngine
    APIRoutes -->|"Typed database queries"| PrismaORM
    SlotEngine -->|"Reads working shifts & overrides"| PrismaORM
    PrismaORM -->|"SQL Queries / Connection Pool"| DB
```

---

## 3. Level 3: Component Diagram

Details the internal modular structure of frontend React components and backend API controllers.

```mermaid
flowchart TD
    subgraph ClientComponents["React Components (Frontend - src/components)"]
        ClientApp["ClientApp.tsx\n(4-Step Booking Wizard,\nCustomer Hub & PWA Banner)"]
        AdminApp["AdminApp.tsx\n(Dashboard, Multi-Staff Calendar,\n1-Touch Overrides & Shifts Editor)"]
        BranchMap["BranchMap.tsx\n(Interactive Leaflet Map Modal)"]
    end

    subgraph APIControllers["Next.js Route Handlers (src/app/api)"]
        AvailabilityAPI["/api/availability\n(Calculates bookable slots by date/staff)"]
        AppointmentsAPI["/api/appointments\n(Atomic bookings, limit guards & cancellations)"]
        AdminShiftsAPI["/api/admin/shifts\n(Validates working hours & prevents inverted shifts)"]
        AdminOverridesAPI["/api/admin/day-override\n(Full-day closures & instant schedule reopening)"]
        AuthAPI["/api/auth/*\n(Credential login & session management)"]
    end

    subgraph DomainLib["Core Domain Logic (src/lib)"]
        SlotEngineModule["slot-engine.ts\n(Pure availability generator,\nlead time filter & past hour exclusion)"]
        BookingRulesModule["booking-rules.ts\n(Cancellation policies & conflict detection)"]
        ValidationModule["acceptance-criteria.ts\n(Inverted shift validation & overlap detection)"]
        SessionModule["session.ts\n(HttpOnly cookie session verification)"]
    end

    ClientApp --> AvailabilityAPI
    ClientApp --> AppointmentsAPI
    ClientApp --> BranchMap
    AdminApp --> AdminShiftsAPI
    AdminApp --> AdminOverridesAPI
    AdminApp --> AuthAPI

    AvailabilityAPI --> SlotEngineModule
    AppointmentsAPI --> BookingRulesModule
    AdminShiftsAPI --> ValidationModule
    AdminOverridesAPI --> BookingRulesModule
```

---

## 4. Level 4: Deployment & Security Architecture

Describes the zero-trust production deployment model, secure session handling, and persistence strategies.

```mermaid
flowchart TD
    subgraph EdgeNetwork["Edge & CDN Network (Vercel Global Edge)"]
        DNS["Anycast DNS & Cloudflare SSL Termination"]
        StaticAssets["Static Edge CDN\n(PWA Shell, Images, Compiled JS Bundles)"]
    end

    subgraph Compute["Serverless Compute Nodes"]
        SSRNode["Next.js Node.js Serverless Functions\n(Dynamic Server-Side Rendering & REST Endpoints)"]
    end

    subgraph DatabaseCluster["Managed Database Cluster"]
        PGServerless[("PostgreSQL Serverless Pool\n(Neon.tech / Supabase / AWS RDS)\nSSL Enforced Mode")]
    end

    DNS --> StaticAssets
    DNS --> SSRNode
    SSRNode -->|"TLS 1.3 / Prisma Connection Pool"| PGServerless
```

### 🔒 Key Architectural & Security Decisions

1. **Decoupled Business Logic (`src/lib`):**
   The core availability and validation algorithms (`slot-engine.ts`, `booking-rules.ts`, `acceptance-criteria.ts`) are pure TypeScript functions independent of the Next.js framework, enabling instant sub-second unit test execution without spinning up an HTTP server.

2. **Role Invariant Defense-in-Depth:**
   - Provider accounts (`PROVIDER`) are strictly prohibited from booking appointments as public patients in `/api/appointments` (enforced at the controller level with HTTP 403).
   - Customers (`CUSTOMER`) attempting to access administrative endpoints or role-switch routes receive an immediate HTTP 403 Forbidden.

3. **Atomic Slot Booking & Collision Prevention:**
   When booking an appointment, the system evaluates slot validity against existing database records inside an atomic verification flow. If two concurrent users attempt to book the same specialist at the exact same minute, the second request is rejected with HTTP 409 Conflict without creating ghost appointments.

4. **Session Security:**
   Administrative and customer authentication utilizes HttpOnly, SameSite=Lax session cookies that cannot be accessed by client-side JavaScript, effectively eliminating XSS-based token theft vulnerabilities.

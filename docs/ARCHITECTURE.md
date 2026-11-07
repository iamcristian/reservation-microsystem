# 🏛️ Arquitectura del Sistema (Diagramas C4 y Principios de Diseño)

Este documento detalla la arquitectura de software de **Sonrisa / Reservas App**, una plataforma moderna de reservas, agendamiento y gestión de citas multi-profesional de alta concurrencia diseñada bajo la metodología de modelado **C4**.

---

## 1. Nivel 1: Diagrama de Contexto del Sistema (System Context)

El diagrama de contexto ilustra cómo los diferentes actores externos (pacientes/clientes, profesionales del equipo y administradores/dueños) interactúan con la plataforma de reservas y con servicios externos de terceros (Google OAuth, WhatsApp y Google Maps).

```mermaid
flowchart TD
    Customer["👤 Cliente / Paciente\n(Navegador Web / Mobile PWA)"]
    Provider["🩺 Profesional / Especialista\n(Portal Restringido /admin)"]
    Admin["👑 Administrador / Dueño\n(Portal Completo /admin)"]
    
    System["🏢 Reservas App Platform\n(Next.js Full-Stack Web App)"]
    
    GoogleOAuth["🔐 Google OAuth 2.0\n(Autenticación de personal)"]
    WhatsAppAPI["💬 WhatsApp Web / App\n(Avisos directos y confirmaciones)"]
    GoogleMaps["🗺️ Google Maps API\n(Ubicación georreferenciada)"]

    Customer -->|"Explora catálogo, selecciona turno y reserva cita"| System
    Provider -->|"Gestiona agenda propia, atiende y bloquea imprevistos"| System
    Admin -->|"Control total: local, equipo, precios y bloqueos"| System

    System -->|"Valida tokens e identidades de personal"| GoogleOAuth
    System -->|"Genera enlaces dinámicos wa.me con mensaje pre-cargado"| WhatsAppAPI
    System -->|"Provee coordenadas interactivas de la sucursal"| GoogleMaps
```

---

## 2. Nivel 2: Diagrama de Contenedores (Container Diagram)

Muestra los bloques de software ejecutables de alto nivel, protocolos de red y almacenamiento de datos persistentes.

```mermaid
flowchart LR
    Browser["🌐 Navegador Web del Usuario\n(Chrome, Safari, Firefox, Edge)\nReact 19 SPA / PWA"]
    
    subgraph NextServer["🖥️ Servidor de Aplicación (Next.js 16 + Turbopack)"]
        EdgeRoutes["Rutas Públicas\n(/, /admin, manifest)"]
        APIRoutes["REST API Endpoints\n(/api/availability, /api/appointments,\n/api/admin/*, /api/auth/*)"]
        SlotEngine["⚙️ Slot Engine & Business Rules\n(Algoritmo de cálculo de cupos y solapamientos)"]
        PrismaORM["⚡ Prisma ORM Client\n(Capa de Acceso a Datos Tipada)"]
    end

    subgraph DataStore["💾 Capa de Persistencia"]
        DB[("Base de Datos Relacional\nSQLite (Dev) / PostgreSQL (Neon/Supabase en Prod)")]
    end

    Browser -->|"HTTPS / JSON"| EdgeRoutes
    Browser -->|"Fetch API / REST JSON"| APIRoutes
    APIRoutes -->|"Consulta disponibilidad y reglas"| SlotEngine
    APIRoutes -->|"Queries tipadas"| PrismaORM
    SlotEngine -->|"Lectura de turnos e imprevistos"| PrismaORM
    PrismaORM -->|"SQL Queries / Pool de Conexiones"| DB
```

---

## 3. Nivel 3: Diagrama de Componentes (Component Diagram)

Detalla la estructura interna de módulos del frontend y controladores backend.

```mermaid
flowchart TD
    subgraph ClientComponents["Componentes React (Frontend - src/components)"]
        ClientApp["ClientApp.tsx\n(Flujo de Reserva de 4 Pasos,\nGestor de Citas y PWA Banner)"]
        AdminApp["AdminApp.tsx\n(Agenda diaria, Imprevistos 1-Toque,\nGestión de Horarios, Clientes y Servicios)"]
        BranchMap["BranchMap.tsx\n(Modal interactivo con mapa geolocalizado)"]
    end

    subgraph CoreLibraries["Módulos de Lógica de Negocio (src/lib)"]
        SlotEng["slot-engine.ts\n(Generación de slots, descarte de horas pasadas,\nrespeto de lead-time y buffer)"]
        BookingRules["booking-rules.ts\n(Validación de turnos no invertidos,\nantelación de cancelación y conflicto de citas)"]
        SessionLib["session.ts & auth.ts\n(Manejo de cookies seguras HTTP-only y roles RBAC)"]
        PrismaLib["prisma.ts\n(Singleton de conexión a base de datos)"]
    end

    subgraph APIControllers["Controladores API (src/app/api)"]
        AvailCtrl["/api/availability/route.ts"]
        ApptCtrl["/api/appointments/route.ts"]
        CancelCtrl["/api/appointments/[id]/cancel/route.ts"]
        OverrideCtrl["/api/admin/day-override/route.ts"]
        ShiftsCtrl["/api/admin/shifts/route.ts"]
    end

    ClientApp -->|"Consulta cupos"| AvailCtrl
    ClientApp -->|"Confirma reserva"| ApptCtrl
    ClientApp -->|"Cancela cita propia"| CancelCtrl
    ClientApp -->|"Abre modal mapa"| BranchMap

    AdminApp -->|"Aplica imprevisto rápido"| OverrideCtrl
    AdminApp -->|"Modifica turnos semanales"| ShiftsCtrl

    AvailCtrl --> SlotEng
    ApptCtrl --> BookingRules
    CancelCtrl --> BookingRules
    ShiftsCtrl --> BookingRules

    SlotEng --> PrismaLib
    BookingRules --> PrismaLib
    OverrideCtrl --> PrismaLib
```

---

## 4. Nivel 4: Diagrama de Despliegue (Deployment Diagram)

Configuración recomendada para despliegue serverless de producción en infraestructura moderna (Vercel / Cloudflare / Render + Base de Datos Gestionada).

```mermaid
flowchart TD
    subgraph CDN["Edge CDN / DNS (Cloudflare / Vercel Edge Network)"]
        SSL["Terminación SSL/TLS\nCache de Assets Estáticos (.js, .css, webp)"]
    end

    subgraph AppHost["Vercel Serverless Functions / Node.js Container"]
        ServerRuntime["Node.js 20+ Runtime\nNext.js Server Handler\n(Variables de Entorno Cifradas)"]
    end

    subgraph ManagedDB["Capa de Base de Datos Gestionada (Neon / Supabase / Turso)"]
        PostgresDB[("PostgreSQL Serverless\n(Connection Pooling activado\ncon réplicas de lectura)")]
    end

    Internet["🌐 Usuarios de Internet"] -->|"HTTPS (Puerto 443)"| SSL
    SSL -->|"Forward Dynamic Requests"| ServerRuntime
    ServerRuntime -->|"DATABASE_URL (Pooling TCP / SSL)"| PostgresDB
```

---

## 5. Principios de Arquitectura e Invariantes Clave

1. **Invariante Temporal Estricto:**
   - La hora de fin de un turno de trabajo siempre debe ser posterior a la hora de inicio ($T_{fin} > T_{inicio}$). El sistema rechaza inmediatamente tanto en frontend como en API turnos invertidos (ej. 20:00 a 19:00).
2. **Alineación con Fecha Local del Negocio:**
   - Para evitar desfases de un día por zonas horarias UTC, todas las operaciones de fecha usan formateadores basados en tiempo local (`formatLocalDateYYYYMMDD`).
3. **Control de Acaparamiento (Anti-Hoarding):**
   - Ningún paciente puede tener más de **2 citas activas simultáneas**.
4. **Política Anti-Trolls (2 Strikes):**
   - Un cliente con 2 faltas registradas (`NO_SHOW`) es bloqueado automáticamente de la plataforma (`isBlocked: true`).
5. **Separación de Roles (RBAC):**
   - Las cuentas profesionales (`PROVIDER`) tienen prohibido auto-agendarse como pacientes. Tienen su panel exclusivo en `/admin`.

# 🔄 Diagramas de Flujo y Secuencia del Sistema

Este documento describe los flujos operativos y transaccionales del sistema modelados mediante **Diagramas de Secuencia Mermaid**.

---

## 1. Flujo de Consulta y Cálculo de Disponibilidad (`Slot Engine`)

Describe cómo el motor de slots evalúa turnos semanales, imprevistos y citas existentes para producir exclusivamente los horarios libres válidos.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 👤 Cliente (Web/Mobile)
    participant UI as 🖥️ ClientApp (React)
    participant API as 🚀 /api/availability
    participant Engine as ⚙️ Slot Engine
    participant DB as 💾 Base de Datos (Prisma)

    Cliente->>UI: Selecciona Servicio y Fecha
    UI->>API: GET /api/availability?serviceId=X&date=YYYY-MM-DD
    API->>DB: Obtener WorkingShifts del día de la semana
    API->>DB: Obtener TimeOffs (imprevistos) activos en la fecha
    API->>DB: Obtener Appointments confirmadas en la fecha
    DB-->>API: Datos consolidados
    
    API->>Engine: computeAvailableSlots(date, shifts, timeOffs, appointments)
    loop Por cada slot candidato (intervalos de 30 min)
        Engine->>Engine: ¿Está dentro del turno de trabajo?
        Engine->>Engine: ¿Es una hora futura (> now + leadTime)?
        Engine->>Engine: ¿Choca con un bloqueo de imprevisto (TimeOff)?
        Engine->>Engine: ¿Choca con una cita ya reservada?
    end
    Engine-->>API: Lista de slots libres (ej: ["09:00", "09:30", "11:00"])
    API-->>UI: HTTP 200 { date, slots: [...] }
    UI-->>Cliente: Renderiza botones de horarios libres
```

---

## 2. Flujo de Reserva Atómica con Asignación Balanceada (`staffId="ANY"`)

Muestra la resolución automática del profesional cuando el paciente elige "Cualquier Profesional disponible".

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 👤 Cliente
    participant UI as 🖥️ ClientApp
    participant API as 🚀 /api/appointments
    participant DB as 💾 Base de Datos

    Cliente->>UI: Selecciona horario y completa datos (Nombre, Tel, Password)
    UI->>API: POST /api/appointments { staffId: "ANY", serviceId, date, time, ... }
    
    API->>DB: Verificar número de citas activas del cliente
    alt Citas activas >= 2
        API-->>UI: HTTP 429 "Máximo 2 citas simultáneas permitidas"
        UI-->>Cliente: Alerta visual roja en checkout
    else Citas activas < 2
        API->>DB: Buscar candidatos con turno activo en el horario
        loop Por cada profesional candidato
            API->>DB: Verificar ausencia de citas y bloqueos en ese intervalo
        end
        API->>DB: Asignar al primer profesional libre disponible
        API->>DB: INSERT INTO Appointment (status: "CONFIRMED")
        API->>DB: INSERT INTO Notification (para cliente)
        DB-->>API: Cita confirmada (ID generado)
        API-->>UI: HTTP 200 { ok: true, appointment }
        UI-->>Cliente: Pantalla de confirmación con círculos concéntricos y QR
    end
```

---

## 3. Flujo de Imprevisto "Cerrar día" y Resolución de Colisiones

Muestra cómo el médico bloquea su agenda y qué sucede con las citas afectadas.

```mermaid
sequenceDiagram
    autonumber
    actor Medico as 🩺 Doctor / Administrador
    participant AdminUI as 🖥️ AdminApp
    participant API as 🚀 /api/admin/day-override
    participant DB as 💾 Base de Datos
    actor Cliente as 👤 Paciente Afectado

    Medico->>AdminUI: Clic en "Cerrar día"
    AdminUI->>AdminUI: Abre modal: Solicita motivo (ej. "Emergencia familiar")
    Medico->>AdminUI: Confirmar bloqueo
    AdminUI->>API: POST /api/admin/day-override { type: "FULL_DAY_OFF", reason, resolution: "CANCEL_ALL" }
    
    API->>DB: INSERT INTO TimeOff (type: "FULL_DAY_OFF", startAt: 00:00, endAt: 23:59)
    API->>DB: UPDATE Appointment SET status="CANCELLED", staffMoveReason=motivo WHERE date=fecha
    API->>DB: INSERT INTO Notification (tipo: "APPOINTMENT_CANCELLED")
    DB-->>API: Bloqueo aplicado
    API-->>AdminUI: HTTP 200 { ok: true, cancelledCount }
    
    AdminUI-->>Medico: Banner rojo: "Día cerrado • 🔓 Reabrir horario"
    Note over Cliente,DB: El paciente ingresa a su portal
    Cliente->>DB: Consulta sus citas (/api/bootstrap)
    DB-->>Cliente: Notificación: "Tu cita fue cancelada por descanso del profesional"
    Cliente->>Cliente: Se archiva en "Historial de citas pasadas y archivo (1)"
```

---

## 4. Flujo de Control Anti-Trolls (Strikes de Inasistencias y Bloqueo)

Muestra la protección contra clientes que no se presentan a sus citas sin previo aviso.

```mermaid
sequenceDiagram
    autonumber
    actor Medico as 🩺 Doctor / Admin
    participant AdminUI as 🖥️ AdminApp
    participant API as 🚀 /api/admin/appointments/[id]/status
    participant DB as 💾 Base de Datos
    actor Cliente as 👤 Paciente

    Note over Medico,Cliente: Pasó la hora de la cita y el paciente no llegó
    Medico->>AdminUI: Clic en botón "⚠️ No se presentó"
    AdminUI->>API: POST /api/admin/appointments/[id]/status { status: "NO_SHOW" }
    
    API->>DB: UPDATE Appointment SET status="NO_SHOW"
    API->>DB: UPDATE User SET noShowCount = noShowCount + 1 WHERE id=customerId
    
    alt noShowCount >= 2
        API->>DB: UPDATE User SET isBlocked = true
        Note over API,DB: Cuenta bloqueada automáticamente (2 Strikes)
    end
    DB-->>API: Estado actualizado
    API-->>AdminUI: HTTP 200 { ok: true, userBlocked: true }
    
    Note over Cliente: Paciente intenta reservar nuevamente en el portal
    Cliente->>API: POST /api/appointments
    API-->>Cliente: HTTP 403 "Cuenta restringida por inasistencias. Contacta por WhatsApp."
```

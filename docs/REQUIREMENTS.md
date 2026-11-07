# 📋 Especificación de Requerimientos y Reglas del Sistema

Este documento establece los **Requerimientos Funcionales (RF)**, **Requerimientos No Funcionales (RNF)** y las **Reglas de Negocio / Invariantes** del sistema de reservas.

---

## 1. Requerimientos Funcionales (RF)

| ID | Módulo | Descripción | Criterio de Éxito |
| :--- | :--- | :--- | :--- |
| **RF-01** | Catálogo | Exponer catálogo público de servicios con precios, duraciones en minutos y buffers. | Carga en < 1s sin autenticación requerida. |
| **RF-02** | Disponibilidad | Calcular cupos libres (`slots`) en intervalos de 30 min descartando horas pasadas y respetando lead-time. | El día actual no ofrece turnos de horas ya transcurridas. |
| **RF-03** | Asignación ANY | Permitir al cliente elegir "Cualquier Profesional" para balancear carga automáticamente. | Asigna al primer especialista disponible sin solapamiento. |
| **RF-04** | Reserva Atómica | Confirmar reservas con nombre, teléfono obligatorio, email y contraseña cifrada. | Previene colisiones simultáneas y genera vista de confirmación. |
| **RF-05** | Anti-Acaparamiento | Limitar a un máximo de 2 citas activas por cliente en simultáneo. | Bloquea el envío de la tercera cita con aviso explicativo. |
| **RF-06** | Separación RBAC | Proveer roles diferenciados: `CUSTOMER` (paciente), `PROVIDER` (empleado/doctor) y `ADMIN` (dueño). | Cuentas `PROVIDER` no pueden agendar como pacientes en `/`. |
| **RF-07** | Turnos Semanales | Permitir al administrador configurar jornadas continuas o partidos por día de la semana. | Valida $T_{fin} > T_{inicio}$ y duración mínima de 30 min. |
| **RF-08** | Imprevistos 1-Toque | Permitir bloqueos rápidos: "Entrar más tarde", "Salir antes" y "Cerrar día". | Genera `TimeOff` e inhabilita inmediatamente los turnos en el portal público. |
| **RF-09** | Reabrir Horario | Permitir al administrador eliminar un bloqueo de imprevisto y reabrir el día. | Los turnos vuelven a estar disponibles de inmediato. |
| **RF-10** | Cancelación Flexible | El cliente puede cancelar su cita con al menos 6 horas de antelación. | Si el médico modificó la cita, la cancelación es siempre libre de penalización. |
| **RF-11** | Control Anti-Trolls | Acumular faltas (`NO_SHOW`) y bloquear automáticamente al paciente al segundo strike. | El usuario bloqueado no puede reservar y debe contactar por WhatsApp. |
| **RF-12** | Marca Blanca | Permitir al dueño configurar el nombre del negocio, logotipo, colores y etiqueta del personal. | Cambia dinámicamente "Doctor(a)", "Barbero", "Estilista", etc. |

---

## 2. Requerimientos No Funcionales (RNF)

1. **RNF-01 Rendimiento:** El endpoint `/api/availability` debe resolver la disponibilidad en menos de 100 ms para ventanas de 7 días.
2. **RNF-02 Responsividad:** Diseño adaptativo con Tailwind CSS 4 que se visualiza de forma óptima tanto en dispositivos móviles (375px+) como en pantallas de escritorio anchas (1280px+).
3. **RNF-03 Seguridad:** Contraseñas cifradas con `bcrypt` (10 rounds de salt), sesiones mediante cookies seguras `HttpOnly` y protección de rutas administrativas contra escalada de privilegios.
4. **RNF-04 Independencia de Zona Horaria:** Eliminación categórica de desfases UTC mediante manipulación de fechas en tiempo local (`formatLocalDateYYYYMMDD`).
5. **RNF-05 Disponibilidad Offline PWA:** Configuración de `manifest.webmanifest` y Service Worker para soporte de instalación como Progressive Web App en celulares y tablets.
6. **RNF-06 Validación Defensiva:** Validación duplicada en cliente (React) y servidor (Next.js API Routes). Cero dependencia de diálogos nativos bloqueantes (`window.alert` / `window.confirm`).

---

## 3. Matriz de Errores Críticos Auditados y Resueltos

| ID Bug | Causa Raíz | Solución Implementada | Estado |
| :--- | :--- | :--- | :---: |
| **BUG-01** | Citas pasadas aparecían en "HOY" a las 21:00. | Comparación contra `new Date()` local + `minLeadTimeMinutes`. | ✅ Resuelto |
| **BUG-02** | "Hoy" mostraba el día siguiente por desfase UTC. | Reemplazo de `toISOString()` por `formatLocalDateYYYYMMDD`. | ✅ Resuelto |
| **BUG-03** | Cierre de día ofrecía mover citas a las 23:59:59. | Bloqueo estricto de resolución `MOVE_TO_END` en `FULL_DAY_OFF`. | ✅ Resuelto |
| **BUG-04** | Imprevistos de día cerrado no tenían botón para reabrir. | Banner `TimeOff` interactivo con botón `🔓 Reabrir horario`. | ✅ Resuelto |
| **BUG-05** | Acordeón de historial oculto cuando `activeApts.length === 0`. | Desacoplamiento del condicional del historial en `ClientApp.tsx`. | ✅ Resuelto |
| **BUG-06** | Formularios de turnos permitían horas invertidas (20:00 a 19:00). | Validación visual inmediata y rechazo HTTP 400 en `/api/admin/shifts`. | ✅ Resuelto |
| **BUG-07** | Inconsistencia de rol: Doctora podía auto-agendarse como cliente. | Invariante RBAC: Redirección automática de cuentas `PROVIDER` a `/admin`. | ✅ Resuelto |
| **BUG-08** | Catálogo de servicios sin botón para editar duración/precios. | Botón `✏️ Editar` en cada tarjeta con modal de actualización reactivo. | ✅ Resuelto |
| **BUG-09** | Contador verde en píldora de fecha contaba citas de toda la clínica. | Filtro dinámico en píldora por doctor seleccionado + opción "Todo el equipo". | ✅ Resuelto |

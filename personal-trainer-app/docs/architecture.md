# Personal Trainer App — Inspección, arquitectura y plan

## 1. Inspección
No había un proyecto previo (carpeta vacía). Se reutilizó, adaptándola, la base de seguridad ya probada en otro servidor
(cookies httpOnly, CSRF, límites de intentos, errores centralizados). No se migró ni sobrescribió nada existente.

## 2. Decisiones técnicas
| Tema | Decisión | Motivo |
|---|---|---|
| Backend | Node 20+, Express 4, **JavaScript ESM** + Zod | Se reutiliza código ya verificado; el tipado de datos lo da Zod en cada endpoint |
| Frontend (Etapa 2+) | React + Vite + **TypeScript**, React Router, CSS Modules + tokens CSS, Lucide, Recharts | TypeScript se prioriza en el frontend nuevo, como se pidió |
| Datos | MongoDB Atlas + Mongoose | Pedido del proyecto |
| Sesión | Access JWT 15 min + refresh opaco rotativo (hash en BD), ambos en cookies `httpOnly`; CSRF por Origin + doble envío | El token no es accesible desde JavaScript |
| Cuentas | **No hay registro público.** El entrenador se crea por script; los alumnos los crea el entrenador y reciben una invitación para elegir su contraseña | Es un negocio con alumnos conocidos; evita altas ajenas |
| Multi-entrenador | Cada documento de negocio lleva `trainer` (id del User entrenador). Toda consulta usa `scopeFor(user)` | Permite crecer a varios entrenadores sin acceso cruzado |
| Autorización | Permiso por rol **+** filtro de propiedad. Un recurso ajeno responde 404 | Un alumno no accede a otro cambiando la URL |
| Pagos | Registro manual (`source: 'manual'`). El modelo ya separa `source: 'provider'` + `provider.externalId` único | Preparado para Mercado Pago sin simular cobros |
| Fechas | Se guardan en UTC; la zona horaria del entrenador se usa para mostrar y validar horarios | Evita errores por cambio de horario |

## 3. Modelo de datos (13 colecciones) — decisiones clave
* **Embebido:** días y ejercicios dentro de `Routine`; medidas y rendimiento dentro de `ProgressMeasurement` (siempre se leen juntos).
* **Referenciado:** `Exercise` (catálogo reutilizable), `StudentProfile`, `MembershipPlan`, `Appointment`, `Payment`.
* `Membership` copia precio y duración del plan al asignarlo (`priceSnapshot`): cambiar el plan no altera el historial.
* `ProgressMeasurement` y `Payment` no se sobrescriben: cada registro es nuevo y fechado; los pagos se **anulan** (no se borran).
* Desactivar un alumno solo cambia `User.status`; no se elimina su historial.
* Duplicados evitados con índices únicos: ejercicio por entrenador (`nameKey`), entrenamiento reintentado (`clientRequestId`), pago de proveedor (`provider.externalId`).
* Superposición de turnos: cada turno ocupa bloques de 15 min (`blocks`) con índice único parcial sobre los turnos activos → la base rechaza superposiciones aun con reservas simultáneas (probado con 8 peticiones en paralelo).

## 4. Flujos principales
1. **Alta de alumno:** entrenador crea ficha → se crea User `pending` + StudentProfile → correo de invitación (7 días) → el alumno elige contraseña → `active`.
2. **Entrenamiento:** entrenador asigna rutina → alumno ve su rutina por día → marca el entrenamiento (idempotente) → el historial alimenta el cumplimiento.
3. **Turnos:** el entrenador define disponibilidad y reglas → el alumno reserva solo dentro de esas reglas → el servidor valida solapamientos.
4. **Pagos:** el entrenador asigna un plan → registra pagos manuales → el dashboard calcula vencimientos e ingresos con datos reales.

## 5. Plan por etapas
| # | Etapa | Estado |
|---|---|---|
| 1 | Inspección y planificación | **Hecha** (este documento) |
| 2 | Diseño y sistema visual (tokens, componentes, dashboard) | **Hecho** (tokens CSS, 10 componentes accesibles, layout responsive, panel) |
| 3 | Base técnica: servidor, modelos, autenticación, seguridad | **Hecha** (ver README) |
| 4a | Alumnos (CRUD, búsqueda, invitación) | **API y pantallas hechas y probadas** |
| 4b | Ejercicios y rutinas | API hecha y probada · **pantallas pendientes** |
| 4c | Progreso | API hecha y probada · **pantallas pendientes** |
| 4d | Agenda y turnos | API hecha y probada (incl. concurrencia) · **pantallas pendientes** |
| 4e | Planes, membresías y pagos | API hecha y probada · **pantallas pendientes** |
| 4f | Dashboard, perfil y configuración | Dashboard **hecho**; configuración/perfil del entrenador: API hecha · **pantalla pendiente** |
| 5 | Pruebas con MongoDB real (hecho para el backend); responsive e integración front–back | Parcial |
| 6 | Seguridad, privacidad, despliegue y datos de demostración | **Documentación y seed hechos**; despliegue real pendiente |

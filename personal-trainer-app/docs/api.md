# API REST — `/api/v1`

Autenticación por cookies `httpOnly` (`pt_at`, `pt_rt`). Toda petición que modifica datos envía `X-CSRF-Token` = valor de la cookie `pt_csrf`
(se obtiene con `GET /auth/csrf`). Errores: `{ "error": { "code", "message", "details?", "requestId" } }`. Listados: `{ items, total, page, limit, pages }`.
Un recurso de otro usuario responde **404** (no se revela su existencia). Rol equivocado → **403**. Sin sesión → **401**.

## Autenticación (público salvo indicación)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/auth/csrf` | Entrega cookie y token CSRF |
| POST | `/auth/login` | Ingreso (límite: 10 intentos/15 min por IP+correo; bloqueo de cuenta tras 5 fallos). Campo opcional `portal` (`student` o `trainer`): si la cuenta es de otro rol responde `403 WRONG_PORTAL` y no abre sesión |
| POST | `/auth/refresh` · `/auth/logout` | Renovar (rotativo) / cerrar sesión |
| GET | `/auth/me` | Usuario actual (autenticado) |
| POST | `/auth/forgot-password` | Envía enlace de recuperación (respuesta idéntica exista o no el correo) |
| POST | `/auth/reset-password` | Define contraseña con token (recuperación **y** activación de invitaciones) |
| POST | `/auth/change-password` | Requiere la contraseña actual; cierra las otras sesiones |

## Entrenador (permisos por rol + propiedad del recurso)
| Módulo | Rutas |
|---|---|
| Alumnos | `GET/POST /students` (`q,status,level,sort,page,limit`) · `GET/PATCH /students/:id` · `POST /students/:id/{deactivate,reactivate,resend-invite}` |
| Dentro de un alumno | `GET /students/:id/{workouts,compliance,progress,progress/compare,memberships}` · `POST /students/:id/{progress,memberships,payments}` |
| Ejercicios | `GET/POST /exercises` · `GET/PATCH /exercises/:id` · `POST /exercises/:id/{archive,restore}` |
| Rutinas | `GET/POST /routines` · `GET/PATCH /routines/:id` · `POST /routines/:id/status` |
| Agenda | `GET/POST /appointments` · `PATCH /appointments/:id` (reprogramar) · `POST /appointments/:id/{status,cancel}` |
| Planes y pagos | `GET/POST /billing/plans` · `PATCH /billing/plans/:id` · `POST /billing/memberships/:id/cancel` · `GET /billing/payments` · `POST /billing/payments/:id/void` · `GET /billing/{pending,summary}` |
| Panel | `GET /dashboard` · `GET/PATCH /settings` |

## Alumno (`/me/*`, solo datos propios)
`GET/PATCH /me/profile` (solo campos habilitados por el entrenador) · `GET /me/routines[/:id]` · `POST/GET /me/workouts` (idempotente por `clientRequestId`) ·
`GET /me/compliance` · `POST/GET /me/progress` · `GET /me/progress/compare` · `GET /me/appointments` · `GET /me/availability?date=AAAA-MM-DD` ·
`POST /me/appointments` · `POST /me/appointments/:id/cancel` · `GET /me/billing`

## Cualquier usuario autenticado
`GET /notifications` · `POST /notifications/read-all` · `POST /notifications/:id/read`

## Reglas de negocio clave
* **Turnos:** bloques de 15 min; la base impide superposiciones aun con reservas simultáneas. El alumno solo reserva en la grilla permitida por el entrenador, con aviso mínimo, antelación máxima y ventana de cancelación configurables.
* **Pagos:** siempre `source: manual`. Se anulan (no se borran). El saldo pendiente = precio − descuento − pagos registrados.
* **Mediciones:** solo se agregan; las notas del entrenador nunca se envían al alumno.

# Personal Trainer App

Aplicación para que un personal trainer administre alumnos, rutinas, progreso, turnos y pagos.
Documentos: [arquitectura y plan](docs/architecture.md) · [API](docs/api.md) · [privacidad](docs/privacy.md) · [despliegue](docs/deployment.md)

## Estado honesto

| Parte | Estado |
|---|---|
| **Backend / API REST** (todos los módulos) | **Completo y probado** contra MongoDB real |
| Seguridad (cookies httpOnly, CSRF, CORS, límites, aislamiento por rol y propiedad) | **Implementada y probada** |
| **Frontend — base y sistema de diseño** (tokens, componentes accesibles, layout responsive, rutas protegidas, cliente HTTP con renovación automática de sesión) | **Hecho y probado** |
| **Frontend — pantallas hechas:** ingreso, recuperar/activar contraseña, panel del entrenador (métricas y gráficos reales), alumnos (listado con búsqueda/filtros/paginación, alta con invitación, ficha, edición, desactivar/reactivar, reenviar invitación), perfil del alumno | **Hechas y conectadas a la API real** |
| **Frontend — pantallas que FALTAN** (la API ya existe): ejercicios, rutinas, progreso, agenda/turnos, planes/membresías/pagos, configuración y perfil del entrenador, notificaciones, y la vista del alumno para su rutina, turnos, progreso y pagos | **No hechas** |
| Datos de demostración (`npm run seed:demo`) | Hecho y probado |
| Despliegue real, envío de correos (SMTP), subida de imágenes, Mercado Pago, exportación/eliminación de datos del alumno | No implementado / no probado |

**No verificado:** el aspecto visual y el comportamiento táctil en un navegador o celular reales (no había navegador en el entorno de desarrollo).
Lo que sí se verificó está detallado abajo. La app todavía no está completa para entregarla a un entrenador: faltan las pantallas indicadas.

## Pruebas
* **Frontend** (`cd client`): `npm test` — 42 pruebas de componentes y pantallas (formularios y validaciones, errores accesibles, rutas protegidas, listados con estados vacío/error/carga, confirmaciones, diálogo con foco atrapado, navegación por rol). `npm run typecheck`, `npm run lint` y `npm run build` pasan.
* **Frontend ↔ backend real** (`npm run test:e2e`, 12 pruebas): el mismo cliente HTTP y endpoints de la app contra el servidor con MongoDB — ingreso, credenciales inválidas, panel con datos reales, alumnos, **renovación automática de sesión con rotación del token**, permisos del alumno, cierre de sesión y fallo de red. Requiere `E2E_API_URL` y `E2E_PASSWORD` (cuentas de `npm run seed:demo`).
* `npm run test:unit` — 36 pruebas sin base de datos (permisos, validaciones, esquemas, CSRF/CORS).
* `npm run test:integration` — 40 pruebas contra **MongoDB real** (requiere `MONGODB_TEST_URI`, p. ej. `mongodb://127.0.0.1:27017`; usa bases temporales que se borran):
  autenticación y bloqueo, rotación de sesiones, aislamiento entre alumnos y entre entrenadores, asignación masiva, idempotencia de entrenamientos,
  comparación de progreso, **8 reservas simultáneas del mismo horario (se confirma una)**, reglas de reserva del alumno, saldos y anulación de pagos,
  dashboard con datos reales y estado vacío.
* Sin `MONGODB_TEST_URI`, las pruebas de integración se omiten (no cuentan como aprobadas).

## Puesta en marcha
Backend (terminal 1):
```bash
cd server
npm install
cp .env.example .env      # completar MONGODB_URI (Atlas) y JWT_SECRET
npm run dev               # http://localhost:4000/api/v1/health
npm run create-trainer -- --email=entrenador@correo.com --name="Nombre Apellido"   # primer entrenador (pide la contraseña)
npm run seed:demo         # opcional: datos de ejemplo (entrenador@demo.local, alumno1@demo.local…); --remove los borra
```
Frontend (terminal 2) — Vite reenvía `/api` al backend, así que no hace falta configurar nada más:
```bash
cd client
npm install
npm run dev        # http://localhost:5173  (ingresá con las cuentas demo o la que creaste con create-trainer)
```
MongoDB local rápido: `docker run -d -p 27017:27017 mongo:7` (las transacciones no son necesarias en esta aplicación).

## Cómo funcionan las cuentas
No hay registro público. El primer entrenador se crea con el script. El entrenador da de alta a sus alumnos (`POST /students`), cada alumno recibe una
invitación por correo para elegir su contraseña (necesita SMTP configurado; en desarrollo el enlace se imprime en la consola) y recién entonces puede ingresar.

## Estructura
```
server/src/{config,models,routes,services,middlewares,validators,utils}
server/scripts/{createTrainer.js, seedDemo.js}
server/tests/{*.test.js, integration/}
client/src/{components/ui,layouts,pages,context,services,hooks,utils,types,styles}
client/tests/{*.test.tsx, e2e/}
docs/
```

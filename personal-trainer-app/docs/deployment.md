# Despliegue (backend + MongoDB Atlas)

> Estado: la configuración está documentada pero **no se desplegó ni probó en un servicio real** desde este entorno. El frontend todavía no existe.

## 1. MongoDB Atlas
1. Crear un cluster, luego *Database Access* → usuario con rol de lectura/escritura **solo sobre la base** de la app.
2. *Network Access* → agregar la IP de saliente de tu servidor (evitá `0.0.0.0/0`).
3. *Connect → Drivers* → copiar la cadena `mongodb+srv://…` y reemplazar `<password>`.
4. Activar copias de seguridad (*Backup*) y revisar la retención.

## 2. Variables de entorno del servidor (`server/.env.example`)
| Variable | Qué poner |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Cadena de Atlas con el nombre de la base (p. ej. `/personal-trainer`) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `CLIENT_URL` | Origen exacto del frontend, sin barra final |
| `COOKIE_SECURE` | `true` (obligatorio en producción; el servidor no arranca sin esto) |
| `COOKIE_SAMESITE` | `lax` si frontend y API comparten sitio (recomendado) |
| `TRUST_PROXY` | `1` detrás de un proxy/PaaS (necesario para que el límite de intentos use la IP real) |
| `SMTP_*`, `MAIL_FROM` | Proveedor de correo (invitaciones y recuperación). Sin SMTP **no se envía ningún correo** |

## 3. Backend
* Cualquier servicio Node 20+ (Render, Railway, Fly.io, VPS). Comando de build: `cd server && npm ci --omit=dev`. Inicio: `npm start`. Health check: `GET /api/v1/health`.
* **Primer entrenador:** ejecutar una vez en la consola del servicio `npm run create-trainer -- --email=… --name="…"` (pide la contraseña sin mostrarla). No existen cuentas por defecto.
* **Índices:** se crean solos al iniciar (`ensureIndexes`). Los de turnos y pagos son necesarios para la integridad.
* **Límite de intentos:** usa memoria del proceso. Con más de una instancia hay que pasar a un almacén compartido (p. ej. Redis).
* **Logs:** JSON por la salida estándar (pino); se consultan en el panel del servicio. Las cookies y contraseñas están redactadas.

## 4. Cookies y dominios
Con `SameSite=Lax` el frontend y la API deben quedar bajo el **mismo sitio**. Opciones: un subdominio de un mismo dominio (`app.tu-dominio.com` y `api.tu-dominio.com`, `COOKIE_DOMAIN=.tu-dominio.com`) o que el hosting del frontend reenvíe `/api/*` al backend. Si fueran sitios distintos habría que usar `SameSite=None; Secure`, con las limitaciones de cookies de terceros de los navegadores.

## 5. Verificar tras desplegar
`GET /api/v1/health` → `db: "connected"` · iniciar sesión con el entrenador · crear un alumno de prueba y comprobar que llega la invitación · revisar que las cookies tengan `HttpOnly` y `Secure`.

## 6. Copias de seguridad y recuperación
Atlas Backup (snapshots). Probá una restauración en un cluster aparte antes de necesitarla.

## 7. Mercado Pago (futuro)
El modelo `Payment` ya separa `source: 'provider'` e impide duplicados por `provider.externalId`. Falta: cuenta de Mercado Pago, credenciales, endpoint de webhook con verificación de firma y alta de pagos solo desde ese webhook.

## 8. Frontend (React + Vite)
> No se desplegó desde este entorno; el build de producción sí se generó y se sirvió localmente con `vite preview`.

1. `cd client && npm ci && npm run build` → genera `client/dist` (archivos estáticos).
2. Publicarlo en Vercel/Netlify/Cloudflare Pages: *Root directory* `client`, *Build command* `npm run build`, *Output* `dist`.
3. **Cookies de sesión:** el frontend llama a `/api/v1/...` en su mismo dominio. Copiá `client/vercel.example.json` a `client/vercel.json` y reemplazá `TU-BACKEND.example.com` por la URL del backend: así el hosting reenvía `/api/*` y las cookies quedan del mismo sitio (`SameSite=Lax`).
4. En el backend: `CLIENT_URL` = URL pública exacta del frontend (por ejemplo `https://app.tu-dominio.com`) y `COOKIE_SECURE=true`.
5. Verificar: abrir la app, ingresar, y en las herramientas del navegador comprobar que las cookies `pt_at`/`pt_rt` tienen `HttpOnly` y `Secure` y que no hay errores en consola.

## 9. Dos sitios: panel del entrenador y app de los alumnos
Un mismo proyecto (`client`) se compila **dos veces**, una por cada público:

| Sitio | Comando | Carpeta generada | Variable del backend |
|---|---|---|---|
| Panel del entrenador | `npm run build:trainer` | `client/dist-trainer` | `CLIENT_URL` |
| App de los alumnos | `npm run build:student` | `client/dist-student` | `STUDENT_URL` |

1. Publicá cada carpeta como un sitio distinto (por ejemplo `entrenador.tu-dominio.com` y `alumnos.tu-dominio.com`). En cada uno copiá `client/vercel.example.json` a `vercel.json` con el mismo reenvío de `/api/*` al backend, para que las cookies queden del mismo sitio.
2. En el backend: `CLIENT_URL` = dirección exacta del panel y `STUDENT_URL` = dirección exacta de la app de alumnos (ambas sin barra final). Las dos quedan habilitadas para CORS/CSRF y los enlaces de invitación y de recuperación apuntan al sitio que le corresponde a cada persona.
3. Opcional: definí `VITE_STUDENT_APP_URL` (en el panel) y `VITE_TRAINER_APP_URL` (en la app de alumnos) como variables de entorno del build, para que la pantalla de "sitio equivocado" muestre un enlace al sitio correcto.
4. Cada sitio solo muestra las pantallas de su rol. **La seguridad real sigue en el backend**: aunque alguien abra el sitio equivocado, la API valida el rol en cada pedido.

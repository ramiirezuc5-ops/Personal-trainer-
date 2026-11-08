# Privacidad y protección de datos — recomendaciones para producción

> Documento técnico de buenas prácticas, **no es asesoramiento legal**. Antes de operar con alumnos reales, revisá con un profesional
> los textos legales y las obligaciones de protección de datos personales aplicables en tu país (en Argentina, la Ley 25.326 y su autoridad de aplicación).

## 1. Qué datos se guardan y por qué
| Dato | Finalidad | Visible para |
|---|---|---|
| Nombre, correo | Identificar y comunicar | Entrenador y alumno |
| Teléfono, fecha de nacimiento (opcionales) | Contacto | Entrenador y alumno |
| Objetivo, nivel, disponibilidad | Planificar el entrenamiento | Entrenador y alumno |
| **Observaciones del entrenador** | Seguimiento interno | **Solo entrenador** |
| Peso, medidas, rendimiento | Seguimiento del progreso | Entrenador y alumno |
| **Notas de cada medición** | Seguimiento interno | **Solo entrenador** |
| Turnos, pagos | Gestión del servicio | Entrenador y alumno (sus propios registros) |

Se recomienda **no** cargar diagnósticos, lesiones detalladas ni información clínica en los campos de texto libre. La aplicación no hace evaluaciones médicas.

## 2. Medidas implementadas en el código
* Contraseñas con hash bcrypt (costo 12); nunca se devuelven en la API ni en los logs.
* Sesión en cookies `httpOnly`; refresh rotativo con detección de reutilización; CSRF; CORS restrictivo; Helmet.
* Aislamiento por entrenador y por alumno verificado con pruebas automatizadas.
* Registros de logs con redacción de cookies y contraseñas; errores sin detalles internos.
* Respuesta idéntica en recuperación de contraseña y en invitaciones (no revela qué correos existen).
* Desactivar un alumno conserva su historial; los pagos se anulan en lugar de borrarse.

## 3. Lo que tenés que hacer vos en producción
1. HTTPS obligatorio (`COOKIE_SECURE=true`).
2. MongoDB Atlas: usuario con permisos mínimos, acceso de red restringido (IPs del servidor, no `0.0.0.0/0`), cifrado en reposo y **copias de seguridad** activadas.
3. `JWT_SECRET` largo y aleatorio, distinto en cada entorno, guardado solo en variables del servidor.
4. Publicar una política de privacidad y términos, y registrar el consentimiento del alumno al darlo de alta.
5. Limitar el acceso a los logs y no copiar datos reales a entornos de prueba (usá `npm run seed:demo`).

## 4. Política de conservación propuesta (a validar legalmente)
* Cuenta activa: mientras dure la relación con el alumno.
* Alumno inactivo: conservar historial hasta 24 meses; luego anonimizar o eliminar a pedido.
* Pagos: conservar según obligaciones contables/impositivas aplicables.
* Tokens de sesión/invitación: se eliminan solos al vencer (índice TTL).

## 5. Derechos de los alumnos
Acceso, rectificación y supresión a pedido. **Pendiente de implementar:** exportación de datos del alumno y eliminación definitiva (hoy solo existe desactivación). Hasta entonces, se resuelve manualmente con el entrenador/administrador.

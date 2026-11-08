import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = env.SMTP_HOST
      ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined })
      : nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export const outbox = []; // solo se llena con NODE_ENV=test (permite probar invitaciones sin SMTP)

async function send({ to, subject, text, html }) {
  if (env.NODE_ENV === 'test') { outbox.push({ to, subject, text }); return; }
  if (!env.SMTP_HOST) {
    // Sin SMTP no se envía nada. Solo en desarrollo se imprime el contenido (incluye enlaces con token).
    if (env.NODE_ENV !== 'production') logger.info({ to, subject, text }, '[correo NO enviado: SMTP no configurado]');
    else logger.warn({ to, subject }, 'SMTP no configurado: el correo no se envió');
    return;
  }
  await getTransporter().sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

const wrap = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111"><h2>${esc(title)}</h2>${body}<p style="color:#666;font-size:12px">${esc(env.APP_NAME)}</p></div>`;
const btn = (url, label) => `<p><a href="${esc(url)}" style="background:#111;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block">${esc(label)}</a></p>`;

export function sendPasswordResetEmail(user, token) {
  const url = `${env.CLIENT_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
  return send({
    to: user.email, subject: `Restablecé tu contraseña — ${env.APP_NAME}`,
    text: `Para elegir una nueva contraseña ingresá a: ${url}\n\nEl enlace vence en 1 hora. Si no lo pediste, ignorá este mensaje.`,
    html: wrap('Restablecé tu contraseña', `<p>Recibimos una solicitud para cambiar tu contraseña.</p>${btn(url, 'Elegir nueva contraseña')}<p style="font-size:12px">Vence en 1 hora. Si no fuiste vos, ignorá este mensaje.</p>`),
  });
}

export function sendInviteEmail(user, trainerName, token) {
  const url = `${env.CLIENT_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}&invitacion=1`;
  return send({
    to: user.email, subject: `${trainerName} te invitó a ${env.APP_NAME}`,
    text: `Hola ${user.name}, ${trainerName} creó tu cuenta. Activala eligiendo tu contraseña: ${url}\n\nEl enlace vence en 7 días.`,
    html: wrap('Activá tu cuenta', `<p>Hola ${esc(user.name)}, ${esc(trainerName)} creó tu cuenta de entrenamiento.</p>${btn(url, 'Activar mi cuenta')}<p style="font-size:12px">El enlace vence en 7 días.</p>`),
  });
}

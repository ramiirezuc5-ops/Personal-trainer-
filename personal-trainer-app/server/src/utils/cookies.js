import { env } from '../config/env.js';

export const ACCESS_COOKIE = 'pt_at';
export const REFRESH_COOKIE = 'pt_rt';
export const CSRF_COOKIE = 'pt_csrf';
export const REFRESH_PATH = '/api/v1/auth';

const base = () => ({ secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, domain: env.COOKIE_DOMAIN });

export function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...base(), httpOnly: true, path: '/', maxAge: env.ACCESS_TOKEN_TTL_MIN * 60_000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base(), httpOnly: true, path: REFRESH_PATH, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
  setCsrfCookie(res, csrfToken);
}

export function setCsrfCookie(res, csrfToken) {
  // Legible por JS a propósito (doble envío). No contiene información de sesión.
  res.cookie(CSRF_COOKIE, csrfToken, { ...base(), httpOnly: false, path: '/', maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...base(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: REFRESH_PATH });
  res.clearCookie(CSRF_COOKIE, { ...base(), path: '/' });
}

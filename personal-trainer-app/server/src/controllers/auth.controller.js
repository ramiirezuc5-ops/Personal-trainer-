import * as authService from '../services/auth.service.js';
import { clearAuthCookies, CSRF_COOKIE, REFRESH_COOKIE, setAuthCookies, setCsrfCookie } from '../utils/cookies.js';
import { randomToken } from '../utils/tokens.js';

const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 200) });
const GENERIC = 'Si los datos son correctos, te enviamos un correo con las instrucciones.';

export const csrf = (req, res) => {
  const token = req.cookies?.[CSRF_COOKIE] || randomToken(24);
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
};
export const login = async (req, res) => {
  const { user, session } = await authService.login(req.body, meta(req));
  setAuthCookies(res, session);
  res.json({ user });
};
export const refresh = async (req, res) => {
  setAuthCookies(res, await authService.refresh(req.cookies?.[REFRESH_COOKIE], meta(req)));
  res.json({ ok: true });
};
export const logout = async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  res.status(204).end();
};
export const me = async (req, res) => { res.json({ user: await authService.getProfile(req.user.id) }); };
export const changePassword = async (req, res) => {
  setAuthCookies(res, await authService.changePassword(req.user.id, req.body, meta(req)));
  res.json({ message: 'Contraseña actualizada.' });
};
export const forgotPassword = async (req, res) => {
  await authService.forgotPassword(req.body.email, meta(req));
  res.status(202).json({ message: GENERIC });
};
export const resetPassword = async (req, res) => {
  await authService.setPasswordWithToken(req.body);
  clearAuthCookies(res);
  res.json({ message: 'Contraseña establecida. Ya podés ingresar.' });
};

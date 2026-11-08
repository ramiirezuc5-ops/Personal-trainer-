const BASE: string = import.meta.env.VITE_API_URL ?? '/api/v1';
const CSRF_COOKIE = 'pt_csrf';

export interface FieldIssue { field: string; message: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: FieldIssue[], public requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const AUTH_EXPIRED_EVENT = 'auth:expired';

function readCsrf(): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

async function ensureCsrf(): Promise<string> {
  let token = readCsrf();
  if (!token) {
    await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
    token = readCsrf();
  }
  return token ?? '';
}

let refreshing: Promise<boolean> | null = null;
// Una sola renovación de sesión a la vez, aunque varias peticiones fallen juntas con 401.
// Se libera apenas termina: quien llegue después y vuelva a recibir 401 pedirá otra.
function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const attempt = (async () => {
    try {
      const csrf = await ensureCsrf();
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrf } });
      return res.ok;
    } catch {
      return false;
    }
  })();
  refreshing = attempt;
  void attempt.finally(() => { if (refreshing === attempt) refreshing = null; });
  return attempt;
}

export type Query = Record<string, string | number | boolean | undefined | null>;
interface Options { body?: unknown; query?: Query; _retried?: boolean }

const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/reset-password', '/auth/forgot-password', '/auth/csrf'];

export async function request<T>(method: string, path: string, { body, query, _retried }: Options = {}): Promise<T> {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = await ensureCsrf();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, { method, credentials: 'include', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.');
  }

  if (res.status === 401 && !_retried && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) return request<T>(method, path, { body, query, _retried: true });
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) { try { data = JSON.parse(text); } catch { /* respuesta sin JSON */ } }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: FieldIssue[]; requestId?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? 'Ocurrió un error inesperado.', err?.details, err?.requestId);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
};

// Convierte los errores de validación del servidor en { campo: mensaje } para mostrarlos junto a cada campo.
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details) return {};
  return Object.fromEntries(err.details.map((d) => [d.field, d.message]));
}

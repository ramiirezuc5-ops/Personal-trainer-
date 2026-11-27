const BASE: string = import.meta.env.VITE_API_URL ?? '/api/v1';
const CSRF_COOKIE = 'pt_csrf';

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: FieldIssue[],
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const AUTH_EXPIRED_EVENT = 'auth:expired';

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

function readCsrf(): string | null {
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`));

  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch(`${BASE}/auth/csrf`, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new ApiError(
        res.status,
        'CSRF_ERROR',
        'No se pudo obtener el token de seguridad.'
      );
    }

    const data = await res.json() as { csrfToken?: string };

    if (!data.csrfToken) {
      throw new ApiError(
        res.status,
        'CSRF_MISSING',
        'El servidor no devolviÃ³ un token de seguridad vÃ¡lido.'
      );
    }

    csrfToken = data.csrfToken;
    return csrfToken;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor para obtener el token de seguridad.'
    );
  }
}

async function ensureCsrf(force = false): Promise<string> {
  if (force) {
    csrfToken = null;
  }

  if (csrfToken) return csrfToken;

  if (!csrfRequest) {
    csrfRequest = (async () => {
      const cookieToken = readCsrf();

      if (cookieToken) {
        csrfToken = cookieToken;
        return cookieToken;
      }

      return fetchCsrfToken();
    })();
  }

  try {
    return await csrfRequest;
  } finally {
    csrfRequest = null;
  }
}

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;

  const attempt = (async () => {
    try {
      const csrf = await ensureCsrf();

      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrf,
        },
      });

      if (!res.ok) return false;

      await ensureCsrf(true);

      return true;
    } catch {
      return false;
    }
  })();

  refreshing = attempt;

  void attempt.finally(() => {
    if (refreshing === attempt) refreshing = null;
  });

  return attempt;
}

export type Query = Record<
  string,
  string | number | boolean | undefined | null
>;

interface Options {
  body?: unknown;
  query?: Query;
  _retried?: boolean;
}

const NO_REFRESH = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/reset-password',
  '/auth/forgot-password',
  '/auth/csrf',
];

const COOKIE_UPDATED = [
  '/auth/login',
  '/auth/change-password',
];

const COOKIE_CLEARED = [
  '/auth/logout',
  '/auth/reset-password',
];

export async function request<T>(
  method: string,
  path: string,
  { body, query, _retried }: Options = {}
): Promise<T> {
  const qs = query
    ? new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';

  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (method !== 'GET') {
    headers['X-CSRF-Token'] = await ensureCsrf();
  }

  let res: Response;

  try {
    res = await fetch(
      `${BASE}${path}${qs ? `?${qs}` : ''}`,
      {
        method,
        credentials: 'include',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }
    );
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No hay conexiÃ³n con el servidor. RevisÃ¡ tu internet e intentÃ¡ de nuevo.'
    );
  }

  if (res.status === 401 && !_retried && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) {
      return request<T>(method, path, {
        body,
        query,
        _retried: true,
      });
    }

    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  const text = await res.text();

  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Respuesta sin JSON.
    }
  }

  if (!res.ok) {
    const err = (
      data as {
        error?: {
          code?: string;
          message?: string;
          details?: FieldIssue[];
          requestId?: string;
        };
      } | null
    )?.error;

    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? 'OcurriÃ³ un error inesperado.',
      err?.details,
      err?.requestId
    );
  }

  if (COOKIE_UPDATED.includes(path)) {
    await ensureCsrf(true);
  }

  if (COOKIE_CLEARED.includes(path)) {
    csrfToken = null;
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) =>
    request<T>('GET', path, { query }),

  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, { body: body ?? {} }),

  patch: <T>(path: string, body: unknown) =>
    request<T>('PATCH', path, { body }),

  delete: <T>(path: string) =>
    request<T>('DELETE', path, {}),
};

// Convierte los errores de validaciÃ³n del servidor en { campo: mensaje }.
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details) return {};

  return Object.fromEntries(
    err.details.map((d) => [d.field, d.message])
  );
}
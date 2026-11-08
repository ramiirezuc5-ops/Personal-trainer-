import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, AUTH_EXPIRED_EVENT, fieldErrors } from '../src/services/api';

const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('cliente HTTP', () => {
  it('envía cookies y el token CSRF en las peticiones que modifican datos', async () => {
    document.cookie = 'pt_csrf=tok123; path=/';
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await api.post('/students', { a: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/students');
    expect(init.credentials).toBe('include');
    expect(init.headers['X-CSRF-Token']).toBe('tok123');
    expect(init.method).toBe('POST');
  });

  it('si no hay token CSRF lo pide primero', async () => {
    fetchMock.mockImplementationOnce(async () => { document.cookie = 'pt_csrf=nuevo; path=/'; return json(200, { csrfToken: 'nuevo' }); }).mockResolvedValueOnce(json(200, {}));
    await api.post('/x');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/csrf');
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe('nuevo');
  });

  it('no manda CSRF en GET y omite parámetros vacíos', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await api.get('/students', { q: 'ana', status: '', page: 2, level: undefined });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/students?q=ana&page=2');
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBeUndefined();
  });

  it('ante un 401 renueva la sesión una sola vez y reintenta', async () => {
    document.cookie = 'pt_csrf=abc; path=/';
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED', message: 'x' } }))
      .mockResolvedValueOnce(json(200, {})) // refresh
      .mockResolvedValueOnce(json(200, { data: 1 }));
    expect(await api.get('/dashboard')).toEqual({ data: 1 });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/v1/dashboard', '/api/v1/auth/refresh', '/api/v1/dashboard']);
  });

  it('varias peticiones con 401 simultáneas comparten UNA sola renovación', async () => {
    document.cookie = 'pt_csrf=abc; path=/';
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return json(200, {});
      const retried = fetchMock.mock.calls.filter((c) => c[0] === url).length > 1;
      return retried ? json(200, { ok: url }) : json(401, { error: { code: 'TOKEN_EXPIRED', message: 'x' } });
    });
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('si no se puede renovar avisa que la sesión expiró', async () => {
    document.cookie = 'pt_csrf=abc; path=/';
    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED', message: 'Expiró' } })).mockResolvedValueOnce(json(401, {}));
    await expect(api.get('/dashboard')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalled();
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  });

  it('un login fallido NO intenta renovar la sesión', async () => {
    document.cookie = 'pt_csrf=abc; path=/';
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' } }));
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('traduce errores del servidor y detalles por campo', async () => {
    document.cookie = 'pt_csrf=abc; path=/';
    fetchMock.mockResolvedValueOnce(json(400, { error: { code: 'VALIDATION_ERROR', message: 'Revisá', details: [{ field: 'email', message: 'Correo inválido' }], requestId: 'r-1' } }));
    const err = await api.post('/students', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(fieldErrors(err)).toEqual({ email: 'Correo inválido' });
    expect((err as ApiError).requestId).toBe('r-1');
  });

  it('un fallo de red se informa como "sin conexión"', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('respuestas sin cuerpo (204) no rompen', async () => {
    document.cookie = 'pt_csrf=abc; path=/';
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api.post('/auth/logout')).toBeNull();
  });
});

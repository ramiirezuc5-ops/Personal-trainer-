// Pruebas HTTP que NO requieren base de datos: rutas, cabeceras de seguridad, CSRF, CORS y autenticación.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import './setupEnv.js';

const { createApp } = await import('../src/app.js');
let server; let base;
before(async () => { await new Promise((r) => { server = createApp().listen(0, r); }); base = `http://127.0.0.1:${server.address().port}/api/v1`; });
after(() => server.close());

const csrf = (t = 't'.repeat(32)) => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': t, Cookie: `pt_csrf=${t}` });

test('health responde con cabeceras de seguridad', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok(res.headers.get('x-request-id'));
});
test('ruta inexistente devuelve 404 JSON', async () => {
  const res = await fetch(`${base}/nada`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});
test('POST sin token CSRF es rechazado', async () => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'CSRF_INVALID');
});
test('POST desde un origen no permitido es rechazado aunque tenga token', async () => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { ...csrf(), Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'CSRF_ORIGIN');
});
test('login inválido devuelve 400 con detalle por campo', async () => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: csrf(), body: JSON.stringify({ email: 'x', password: '' }) });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.some((d) => d.field === 'email'));
});
test('JSON malformado devuelve 400 sin detalles internos', async () => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: csrf(), body: '{no-json' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_JSON');
});
test('endpoint protegido sin sesión devuelve 401, y un token falso también', async () => {
  assert.equal((await fetch(`${base}/auth/me`)).status, 401);
  const fake = await fetch(`${base}/auth/me`, { headers: { Cookie: 'pt_at=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.' } });
  assert.equal(fake.status, 401);
});
test('no existe registro público de cuentas', async () => {
  const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: csrf(), body: '{}' });
  assert.equal(res.status, 404);
});
test('CORS: solo el origen del frontend recibe cabeceras de acceso', async () => {
  const ok = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const bad = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
test('GET /auth/csrf entrega cookie y token', async () => {
  const res = await fetch(`${base}/auth/csrf`);
  assert.ok((await res.json()).csrfToken);
  assert.match(res.headers.get('set-cookie') ?? '', /pt_csrf=/);
});

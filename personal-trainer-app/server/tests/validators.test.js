import test from 'node:test';
import assert from 'node:assert/strict';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from '../src/validators/auth.validators.js';

test('login normaliza el correo', () => {
  const r = loginSchema.safeParse({ email: ' ANA@Example.com ', password: 'x' });
  assert.equal(r.success, true);
  assert.equal(r.data.email, 'ana@example.com');
});
test('login rechaza operadores de MongoDB en lugar de strings', () => {
  assert.equal(loginSchema.safeParse({ email: { $ne: null }, password: { $ne: null } }).success, false);
});
test('login rechaza campos desconocidos', () => {
  assert.equal(loginSchema.safeParse({ email: 'a@b.com', password: 'x', role: 'trainer' }).success, false);
});
test('la nueva contraseña exige largo y combinación de letras y números', () => {
  const token = 't'.repeat(30);
  for (const password of ['corta1', 'soloLetrasLargas', '1234567890', `a1${'x'.repeat(80)}`]) {
    assert.equal(resetPasswordSchema.safeParse({ token, password }).success, false, password);
  }
  assert.equal(resetPasswordSchema.safeParse({ token, password: 'clave12345x' }).success, true);
});
test('forgot-password valida el correo', () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: 'no-es-correo' }).success, false);
});

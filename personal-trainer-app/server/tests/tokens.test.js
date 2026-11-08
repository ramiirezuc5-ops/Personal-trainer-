import test from 'node:test';
import assert from 'node:assert/strict';
import { hashToken, randomToken, safeEqual } from '../src/utils/tokens.js';

test('hashToken es determinista y no revela el token', () => {
  const t = randomToken();
  assert.equal(hashToken(t), hashToken(t));
  assert.notEqual(hashToken(t), t);
  assert.equal(hashToken(t).length, 64);
});
test('randomToken no se repite', () => {
  assert.equal(new Set(Array.from({ length: 2000 }, () => randomToken())).size, 2000);
});
test('safeEqual compara correctamente', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

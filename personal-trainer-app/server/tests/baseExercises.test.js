import assert from 'node:assert/strict';
import test from 'node:test';
import { BASE_EXERCISES } from '../src/data/baseExercises.js';

// Mismos valores que MUSCLE_GROUPS en models/Exercise.js y mismos límites que el modelo y los validadores.
const GROUPS = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'piernas', 'gluteos', 'core', 'cardio', 'cuerpo_completo', 'movilidad'];
const LIMITS = { name: 100, equipment: 100, description: 500, instructions: 1500, commonMistakes: 800 };

test('la biblioteca base tiene ejercicios en todos los grupos musculares', () => {
  assert.ok(BASE_EXERCISES.length >= 100);
  for (const g of GROUPS) assert.ok(BASE_EXERCISES.filter((e) => e.muscleGroup === g).length >= 5, `faltan ejercicios de ${g}`);
});

test('cada ejercicio es válido y respeta los límites del sistema', () => {
  for (const e of BASE_EXERCISES) {
    assert.ok(GROUPS.includes(e.muscleGroup), `grupo inválido en ${e.name}`);
    assert.ok(e.name.length >= 2, 'nombre demasiado corto');
    for (const [field, max] of Object.entries(LIMITS)) {
      assert.equal(typeof e[field], 'string', `${field} de ${e.name}`);
      assert.ok(e[field].length > 0 && e[field].length <= max, `${field} de ${e.name} fuera de límite`);
      assert.equal(e[field], e[field].trim(), `${field} de ${e.name} tiene espacios sobrantes`);
    }
  }
});

test('los nombres no se repiten (el catálogo evita duplicados por nombre)', () => {
  const keys = BASE_EXERCISES.map((e) => e.name.toLowerCase());
  assert.equal(new Set(keys).size, keys.length);
});

test('incluye los ejercicios básicos que suelen cargarse primero', () => {
  const names = new Set(BASE_EXERCISES.map((e) => e.name));
  for (const n of ['Sentadilla', 'Press banca', 'Remo con barra', 'Peso muerto', 'Plancha frontal']) assert.ok(names.has(n), n);
});

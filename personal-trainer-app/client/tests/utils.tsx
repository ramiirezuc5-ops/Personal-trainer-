import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '../src/services/api';
import { mocks } from './mocks';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import type { Student, StudentDetail, User } from '../src/types/api';

export { mocks };

export const trainer: User = { id: 't1', name: 'Marta Entrenadora', email: 'marta@test.com', role: 'trainer', status: 'active' };
export const studentUser: User = { id: 'u1', name: 'Ana Alumna', email: 'ana@test.com', role: 'student', status: 'active' };

export const makeStudent = (over: Partial<StudentDetail> = {}): StudentDetail => ({
  id: 's1', firstName: 'Ana', lastName: 'Pérez', email: 'ana@test.com', status: 'active', phone: '', birthDate: null, goal: 'Bajar de peso',
  experienceLevel: 'principiante', availability: '', notes: 'nota', studentEditableFields: ['phone'], joinedAt: '2026-01-10T00:00:00Z', createdAt: '2026-01-10T00:00:00Z',
  summary: { activeRoutines: 1, lastWorkoutAt: null, nextAppointment: null, membership: null }, ...over,
});
export const asStudent = (s: StudentDetail): Student => s;

interface Opts { route?: string; user?: User | null; path?: string }
// Renderiza con rutas, sesión y avisos reales; solo la capa HTTP está simulada.
export function renderApp(ui: ReactElement, { route = '/pagina', user = trainer, path }: Opts = {}) {
  mocks.authApi.me.mockReset();
  if (user) mocks.authApi.me.mockResolvedValue({ user }); else mocks.authApi.me.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Necesitás iniciar sesión.'));
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider><ToastProvider><Routes><Route path={path ?? route.split('?')[0]} element={ui} /><Route path="/ingresar" element={<div>PANTALLA-INGRESO</div>} /><Route path="/" element={<div>INICIO</div>} /></Routes></ToastProvider></AuthProvider>
    </MemoryRouter>,
  );
}

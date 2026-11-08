import { vi } from 'vitest';

// Capa HTTP simulada. Cada archivo de prueba la registra con:
//   vi.mock('../src/services/endpoints', async () => (await import('./mocks')).mocks);
export const mocks = {
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn(), forgot: vi.fn(), reset: vi.fn() },
  dashboardApi: { get: vi.fn() },
  studentsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn(), resendInvite: vi.fn() },
  meApi: { profile: vi.fn(), updateProfile: vi.fn() },
};

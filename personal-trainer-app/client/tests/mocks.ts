import { vi } from 'vitest';

// Capa HTTP simulada. Cada archivo de prueba la registra con:
//   vi.mock('../src/services/endpoints', async () => (await import('./mocks')).mocks);
//
// Todo método que una pantalla llama automáticamente al montarse (dentro de un useAsync sin que el
// test lo pida) tiene acá un valor por defecto ya resuelto. Sin esto, la promesa queda colgada y
// cualquier pantalla que la use de fondo (como la mensualidad dentro de la ficha del alumno) revienta
// con "No existe mock" o se queda cargando para siempre. Cada test puede pisar el valor con mockResolvedValue/mockResolvedValueOnce.
export const mocks = {
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn(), forgot: vi.fn(), reset: vi.fn() },
  dashboardApi: { get: vi.fn() },
  studentsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn(), resendInvite: vi.fn() },
  meApi: {
    profile: vi.fn(), updateProfile: vi.fn(),
    routines: vi.fn().mockResolvedValue([]),
    routine: vi.fn(),
    logWorkout: vi.fn(),
    workouts: vi.fn().mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 }),
    compliance: vi.fn().mockResolvedValue({ expected: 0, completed: 0, percentage: null }),
    billing: vi.fn().mockResolvedValue({ memberships: [], payments: [] }),
    appointments: vi.fn().mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 }),
    availability: vi.fn().mockResolvedValue({ enabled: false, timezone: 'America/Argentina/Buenos_Aires', slots: [] }),
    book: vi.fn(),
    cancelAppointment: vi.fn(),
  },
  exercisesApi: {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 }),
    create: vi.fn(), update: vi.fn(), archive: vi.fn(), restore: vi.fn(), remove: vi.fn(),
    importBase: vi.fn().mockResolvedValue({ created: 0, skipped: 0, total: 0 }),
    listAll: vi.fn().mockResolvedValue([]),
  },
  routinesApi: {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 }),
    get: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), duplicate: vi.fn(), remove: vi.fn(),
  },
  billingApi: {
    plans: vi.fn().mockResolvedValue([]),
    createPlan: vi.fn(), updatePlan: vi.fn(),
    memberships: vi.fn().mockResolvedValue([]),
    assignMembership: vi.fn(), cancelMembership: vi.fn(),
    createPayment: vi.fn(),
    payments: vi.fn().mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 }),
    voidPayment: vi.fn(),
    pending: vi.fn().mockResolvedValue([]),
    summary: vi.fn().mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires', byMonth: [], totals: [] }),
  },
  appointmentsApi: {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 }),
    create: vi.fn(), reschedule: vi.fn(), setStatus: vi.fn(), cancel: vi.fn(),
  },
  settingsApi: {
    get: vi.fn().mockResolvedValue({
      name: 'Entrenador', email: 'coach@demo.local', businessName: '', phone: '', bio: '', photoUrl: '',
      timezone: 'America/Argentina/Buenos_Aires', currency: 'ARS', workingHours: [],
      notifications: { email: true, paymentDue: true, appointmentReminders: true },
      booking: { allowStudentBooking: false, slotMinutes: 60, minNoticeHours: 12, maxAdvanceDays: 30, cancellationHours: 12 },
    }),
    update: vi.fn(),
  },
};

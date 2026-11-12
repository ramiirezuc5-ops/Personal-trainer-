import type { Compliance, Dashboard, MembershipInput, MyBilling, MyMembership, PaymentInput, PaymentRow, PendingRow, Plan, PlanInput, RevenueSummary, Exercise, ExerciseInput, MyRoutineSummary, Paged, RoutineCore, RoutineDetail, RoutineInput, RoutineStatus, RoutineSummary, Student, StudentDetail, StudentInput, User, WorkoutInput, WorkoutRecord } from '../types/api';
import { api } from './api';

export const authApi = {
  login: (email: string, password: string) => api.post<{ user: User }>('/auth/login', { email, password }),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<{ user: User }>('/auth/me'),
  forgot: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),
  reset: (token: string, password: string) => api.post<{ message: string }>('/auth/reset-password', { token, password }),
};

export const dashboardApi = { get: () => api.get<Dashboard>('/dashboard') };

export interface StudentListParams { q?: string; status?: string; level?: string; sort?: string; page?: number; limit?: number }
export const studentsApi = {
  list: (params: StudentListParams) => api.get<Paged<Student>>('/students', { ...params }),
  get: (id: string) => api.get<StudentDetail>(`/students/${id}`),
  create: (input: StudentInput) => api.post<Student>('/students', input),
  update: (id: string, input: Partial<StudentInput>) => api.patch<Student>(`/students/${id}`, input),
  deactivate: (id: string) => api.post<Student>(`/students/${id}/deactivate`),
  reactivate: (id: string) => api.post<Student>(`/students/${id}/reactivate`),
  resendInvite: (id: string) => api.post<{ message: string }>(`/students/${id}/resend-invite`),
};

export const meApi = {
  profile: () => api.get<Student>('/me/profile'),
  updateProfile: (patch: Partial<Pick<StudentInput, 'phone' | 'birthDate' | 'goal' | 'availability'>>) => api.patch<Student>('/me/profile', patch),
  routines: () => api.get<MyRoutineSummary[]>('/me/routines'),
  routine: (id: string) => api.get<RoutineDetail>(`/me/routines/${id}`),
  logWorkout: (input: WorkoutInput) => api.post<WorkoutRecord & { duplicate: boolean }>('/me/workouts', input),
  workouts: (params: { page?: number; limit?: number } = {}) => api.get<Paged<WorkoutRecord>>('/me/workouts', { ...params }),
  compliance: (from: string, to: string) => api.get<Compliance>('/me/compliance', { from, to }),
  billing: () => api.get<MyBilling>('/me/billing'),
};

export interface ExerciseListParams { q?: string; muscleGroup?: string; archived?: boolean; page?: number; limit?: number }
export const exercisesApi = {
  list: (params: ExerciseListParams) => api.get<Paged<Exercise>>('/exercises', { ...params, archived: params.archived ? 'true' : 'false' }),
  create: (input: ExerciseInput) => api.post<Exercise>('/exercises', input),
  update: (id: string, input: Partial<ExerciseInput>) => api.patch<Exercise>(`/exercises/${id}`, input),
  archive: (id: string) => api.post<Exercise>(`/exercises/${id}/archive`),
  restore: (id: string) => api.post<Exercise>(`/exercises/${id}/restore`),
};

export interface RoutineListParams { student?: string; status?: string; page?: number; limit?: number }
export const routinesApi = {
  list: (params: RoutineListParams) => api.get<Paged<RoutineSummary>>('/routines', { ...params }),
  get: (id: string) => api.get<RoutineDetail>(`/routines/${id}`),
  create: (input: RoutineInput) => api.post<RoutineDetail>('/routines', input),
  update: (id: string, patch: Partial<RoutineCore>) => api.patch<RoutineDetail>(`/routines/${id}`, patch),
  setStatus: (id: string, status: RoutineStatus) => api.post<RoutineSummary>(`/routines/${id}/status`, { status }),
};

export const billingApi = {
  plans: (includeInactive: boolean) => api.get<Plan[]>('/billing/plans', { includeInactive: includeInactive ? 'true' : 'false' }),
  createPlan: (input: PlanInput) => api.post<Plan>('/billing/plans', input),
  updatePlan: (id: string, patch: Partial<PlanInput> & { active?: boolean }) => api.patch<Plan>(`/billing/plans/${id}`, patch),
  memberships: (studentId: string) => api.get<MyMembership[]>(`/students/${studentId}/memberships`),
  assignMembership: (studentId: string, input: MembershipInput) => api.post<MyMembership>(`/students/${studentId}/memberships`, input),
  cancelMembership: (id: string) => api.post<MyMembership>(`/billing/memberships/${id}/cancel`),
  createPayment: (studentId: string, input: PaymentInput) => api.post<PaymentRow>(`/students/${studentId}/payments`, input),
  payments: (params: { page?: number; limit?: number } = {}) => api.get<Paged<PaymentRow>>('/billing/payments', { ...params }),
  voidPayment: (id: string, reason: string) => api.post<PaymentRow>(`/billing/payments/${id}/void`, { reason }),
  pending: () => api.get<PendingRow[]>('/billing/pending'),
  summary: (from?: string, to?: string) => api.get<RevenueSummary>('/billing/summary', { from, to }),
};

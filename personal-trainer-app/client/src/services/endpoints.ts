import type { Dashboard, Paged, Student, StudentDetail, StudentInput, User } from '../types/api';
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
};

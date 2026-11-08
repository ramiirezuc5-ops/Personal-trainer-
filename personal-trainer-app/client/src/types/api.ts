export type Role = 'trainer' | 'student';
export type UserStatus = 'active' | 'inactive' | 'pending';
export type Level = 'principiante' | 'intermedio' | 'avanzado';

export interface User { id: string; name: string; email: string; role: Role; status: UserStatus }

export interface Student {
  id: string; firstName: string; lastName: string; email: string; status: UserStatus;
  phone: string; birthDate: string | null; goal: string; experienceLevel: Level; availability: string;
  notes?: string; studentEditableFields: string[]; joinedAt: string; createdAt: string;
}
export interface StudentDetail extends Student {
  summary: {
    activeRoutines: number; lastWorkoutAt: string | null;
    nextAppointment: { start: string; end: string; status: string } | null;
    membership: { status: string; startDate: string; endDate: string } | null;
  };
}
export interface Paged<T> { items: T[]; total: number; page: number; limit: number; pages: number }

export interface Dashboard {
  timezone: string; isEmpty: boolean;
  students: { active: number; pending: number; inactive: number; total: number; new30d: number };
  todayAppointments: { _id: string; start: string; end: string; status: string; type: string; student?: { firstName: string; lastName: string } }[];
  membershipsDueSoon: { id: string; endDate: string; student: { id: string; name: string } | null }[];
  pendingPayments: { count: number; totals: Record<string, number>; items: { _id: string; due: number; currency: string; endDate: string; student: { id: string; firstName: string; lastName: string } }[] };
  revenueThisMonth: { currency: string; total: number; count: number }[];
  charts: { months: string[]; newStudentsByMonth: number[]; revenueByMonth: { currency: string; values: number[] }[] };
  recentActivity: { type: 'entrenamiento' | 'pago' | 'turno'; at: string; text: string }[];
}

export interface StudentInput {
  firstName: string; lastName: string; email: string; phone?: string; birthDate?: string; goal?: string;
  experienceLevel?: Level; availability?: string; notes?: string; studentEditableFields?: string[];
}

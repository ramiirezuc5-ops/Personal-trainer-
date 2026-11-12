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

/* ---------- Ejercicios y rutinas ---------- */
export type MuscleGroup = 'pecho' | 'espalda' | 'hombros' | 'biceps' | 'triceps' | 'piernas' | 'gluteos' | 'core' | 'cardio' | 'cuerpo_completo' | 'movilidad';
export type MediaKind = 'image' | 'video';

export interface Exercise {
  _id: string; name: string; muscleGroup: MuscleGroup; description: string; equipment: string;
  instructions: string; commonMistakes: string; media?: { url: string; kind: MediaKind }; archived: boolean; createdAt: string;
}
export interface ExerciseInput {
  name: string; muscleGroup: MuscleGroup; description?: string; equipment?: string;
  instructions?: string; commonMistakes?: string; media?: { url: string; kind: MediaKind };
}

export type RoutineStatus = 'borrador' | 'activa' | 'finalizada' | 'archivada';
export type Difficulty = 'baja' | 'media' | 'alta';
export type WeightUnit = 'kg' | 'lb';

export interface RoutineItemInput {
  exercise: string; sets: number; reps: string; weight?: { value: number; unit: WeightUnit }; restSeconds?: number; notes?: string;
}
export interface RoutineDayInput { dayOfWeek: number; label?: string; exercises: RoutineItemInput[] }
export interface RoutineInput {
  student: string; name: string; description?: string; goal?: string; difficulty?: Difficulty; estimatedMinutes?: number;
  startDate: string; endDate?: string; status?: 'borrador' | 'activa'; days: RoutineDayInput[];
}
export type RoutineCore = Omit<RoutineInput, 'student' | 'status' | 'endDate'> & { endDate?: string | null };

export interface RoutineSummary {
  _id: string; student: string; name: string; description: string; goal: string; difficulty: Difficulty; estimatedMinutes?: number;
  startDate: string; endDate: string | null; status: RoutineStatus; dayCount: number; createdAt: string;
}
export type RoutineExerciseRef = Pick<Exercise, '_id' | 'name' | 'muscleGroup' | 'equipment' | 'instructions' | 'commonMistakes' | 'media'>;
export interface RoutineDetail extends Omit<RoutineSummary, 'dayCount'> {
  days: {
    _id: string; dayOfWeek: number; label: string;
    exercises: { _id: string; exercise: RoutineExerciseRef | null; sets: number; reps: string; weight?: { value?: number; unit: WeightUnit }; restSeconds: number; notes: string }[];
  }[];
}

/* ---------- Vista del alumno ---------- */
export type MyRoutineSummary = Omit<RoutineSummary, 'dayCount'> & { days: { _id: string; dayOfWeek: number; label: string }[] };

export interface WorkoutRecord {
  _id: string; routine: { _id: string; name: string } | null; dayId: string; performedAt: string;
  exercises: { exercise: { _id: string; name: string } | null; completed: boolean; sets: { reps?: number; weight?: number; unit?: WeightUnit }[] }[];
  durationMinutes?: number; notes: string;
}
export interface WorkoutInput {
  routine: string; dayId: string; performedAt?: string; durationMinutes?: number; notes?: string; clientRequestId: string;
  exercises: { exercise: string; completed: boolean; sets?: { reps: number; weight?: number; unit?: WeightUnit }[] }[];
}
export interface Compliance { expected: number; completed: number; percentage: number | null }

/* ---------- Mensualidad y pagos (alumno) ---------- */
export type MembershipStatus = 'pendiente' | 'activa' | 'vencida' | 'cancelada';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
export interface MyMembership {
  _id: string; plan: { _id: string; name: string } | null; priceSnapshot: { amount: number; currency: string };
  startDate: string; endDate: string; status: MembershipStatus; discount?: { amount: number; reason?: string };
  paid: number; owed: number; due: number;
}
export interface MyPayment {
  _id: string; membership: string | null; amount: number; currency: string; paidAt: string; method: PaymentMethod;
  periodStart?: string; periodEnd?: string; status: 'registrado' | 'anulado';
}
export interface MyBilling { memberships: MyMembership[]; payments: MyPayment[] }

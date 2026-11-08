import mongoose from 'mongoose';
export { User } from './User.js';
export { AuthToken } from './AuthToken.js';
export { TrainerProfile } from './TrainerProfile.js';
export { StudentProfile } from './StudentProfile.js';
export { Exercise } from './Exercise.js';
export { Routine } from './Routine.js';
export { WorkoutLog } from './WorkoutLog.js';
export { ProgressMeasurement } from './ProgressMeasurement.js';
export { Appointment } from './Appointment.js';
export { MembershipPlan } from './MembershipPlan.js';
export { Membership } from './Membership.js';
export { Payment } from './Payment.js';
export { Notification } from './Notification.js';

// Construye los índices (únicos y parciales) antes de aceptar tráfico.
export const ensureIndexes = () => Promise.all(Object.values(mongoose.models).map((m) => m.init()));

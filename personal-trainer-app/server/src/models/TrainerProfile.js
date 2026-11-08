import mongoose from 'mongoose';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '../config/constants.js';

const hoursSchema = new mongoose.Schema(
  { weekday: { type: Number, min: 0, max: 6, required: true }, start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ } },
  { _id: false },
);

// 1:1 con el User entrenador. Un User entrenador = un "tenant": todo documento de negocio lleva su id en `trainer`.
const trainerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    businessName: { type: String, trim: true, maxlength: 100, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    photoUrl: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true, match: /^[A-Z]{3}$/ },
    workingHours: { type: [hoursSchema], default: [] },
    isDemo: { type: Boolean, default: false },
    notifications: {
      email: { type: Boolean, default: true },
      paymentDue: { type: Boolean, default: true },
      appointmentReminders: { type: Boolean, default: true },
    },
    // Reglas de reserva que definen qué puede pedir un alumno (Etapa de agenda).
    booking: {
      allowStudentBooking: { type: Boolean, default: false },
      slotMinutes: { type: Number, default: 60, min: 15, max: 240 },
      minNoticeHours: { type: Number, default: 12, min: 0 },
      maxAdvanceDays: { type: Number, default: 30, min: 1 },
      cancellationHours: { type: Number, default: 12, min: 0 },
    },
  },
  { timestamps: true },
);
trainerProfileSchema.path('timezone').validate((tz) => { try { new Intl.DateTimeFormat('es-AR', { timeZone: tz }); return true; } catch { return false; } }, 'Zona horaria inválida');

export const TrainerProfile = mongoose.model('TrainerProfile', trainerProfileSchema);

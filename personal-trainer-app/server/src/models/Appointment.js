import mongoose from 'mongoose';

// start/end se guardan en UTC; la zona horaria del entrenador (TrainerProfile.timezone) solo se usa para mostrar y validar horarios.
const appointmentSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    type: { type: String, trim: true, maxlength: 60, default: 'Sesión individual' },
    status: { type: String, enum: ['reservado', 'confirmado', 'completado', 'cancelado'], default: 'reservado' },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cancellation: { at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, maxlength: 300 } },
    // Reprogramar actualiza el turno en el lugar (atómico) y deja constancia de los horarios anteriores.
    history: { type: [{ _id: false, start: Date, end: Date, at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }], default: [] },
    // Cada turno ocupa bloques de 15 min ("<entrenador>:<minuto/15>"). El índice único sobre los turnos activos
    // hace que la base rechace una superposición aunque dos reservas lleguen al mismo tiempo.
    blocks: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
appointmentSchema.index({ blocks: 1 }, { unique: true, partialFilterExpression: { active: true } });
appointmentSchema.path('end').validate(function validateEnd(end) { return !this.start || end > this.start; }, 'La finalización debe ser posterior al inicio');
appointmentSchema.index({ trainer: 1, start: 1, end: 1 });
appointmentSchema.index({ trainer: 1, status: 1, start: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);

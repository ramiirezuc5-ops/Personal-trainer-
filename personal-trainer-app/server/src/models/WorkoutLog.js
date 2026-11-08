import mongoose from 'mongoose';

const setSchema = new mongoose.Schema({ reps: { type: Number, min: 0 }, weight: { type: Number, min: 0 }, unit: { type: String, enum: ['kg', 'lb'], default: 'kg' } }, { _id: false });

const workoutLogSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    routine: { type: mongoose.Schema.Types.ObjectId, ref: 'Routine', required: true },
    dayId: { type: mongoose.Schema.Types.ObjectId, required: true },
    performedAt: { type: Date, required: true },
    exercises: { type: [{ _id: false, exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }, completed: { type: Boolean, default: false }, sets: { type: [setSchema], default: [] } }], default: [] },
    durationMinutes: { type: Number, min: 0, max: 600 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    // Evita duplicados por doble clic o reintentos de red: se genera en el cliente por cada envío.
    clientRequestId: { type: String, trim: true, maxlength: 80 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
workoutLogSchema.index({ student: 1, performedAt: -1 });
workoutLogSchema.index({ student: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } });

export const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);

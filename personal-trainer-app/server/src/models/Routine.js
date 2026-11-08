import mongoose from 'mongoose';

// Días y ejercicios van EMBEBIDOS: se leen siempre juntos y pertenecen a una única rutina.
const routineExerciseSchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    sets: { type: Number, min: 1, max: 20, required: true },
    reps: { type: String, trim: true, maxlength: 20, required: true }, // "10", "8-12", "30s"
    weight: { value: { type: Number, min: 0 }, unit: { type: String, enum: ['kg', 'lb'], default: 'kg' } },
    restSeconds: { type: Number, min: 0, max: 900, default: 60 },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: true },
);
const routineDaySchema = new mongoose.Schema(
  { dayOfWeek: { type: Number, min: 0, max: 6, required: true }, label: { type: String, trim: true, maxlength: 60, default: '' }, exercises: { type: [routineExerciseSchema], default: [] } },
  { _id: true },
);

const routineSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    goal: { type: String, trim: true, maxlength: 200, default: '' },
    difficulty: { type: String, enum: ['baja', 'media', 'alta'], default: 'media' },
    estimatedMinutes: { type: Number, min: 5, max: 300 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ['borrador', 'activa', 'finalizada', 'archivada'], default: 'borrador' },
    days: { type: [routineDaySchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
routineSchema.index({ trainer: 1, student: 1, status: 1 });

export const Routine = mongoose.model('Routine', routineSchema);

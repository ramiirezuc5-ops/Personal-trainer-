import mongoose from 'mongoose';

export const MUSCLE_GROUPS = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'piernas', 'gluteos', 'core', 'cardio', 'cuerpo_completo', 'movilidad'];
export const EXERCISE_DIFFICULTIES = ['principiante', 'intermedio', 'avanzado'];

const exerciseSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, lowercase: true, trim: true }, // evita duplicados dentro del catálogo del entrenador
    muscleGroup: { type: String, enum: MUSCLE_GROUPS, required: true },
    // Músculos de apoyo, además del principal. Nunca repite al principal (lo valida el servicio).
    secondaryMuscles: { type: [{ type: String, enum: MUSCLE_GROUPS }], default: [] },
    difficulty: { type: String, enum: EXERCISE_DIFFICULTIES, default: null },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    equipment: { type: String, trim: true, maxlength: 100, default: '' },
    instructions: { type: String, trim: true, maxlength: 1500, default: '' },
    commonMistakes: { type: String, trim: true, maxlength: 800, default: '' },
    media: { url: { type: String, trim: true }, kind: { type: String, enum: ['image', 'video'] } },
    archived: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false }, // datos de demostración identificados
  },
  { timestamps: true },
);
exerciseSchema.index({ trainer: 1, nameKey: 1 }, { unique: true });
exerciseSchema.index({ trainer: 1, muscleGroup: 1 });

export const Exercise = mongoose.model('Exercise', exerciseSchema);

import mongoose from 'mongoose';

export const STUDENT_EDITABLE_FIELDS = ['phone', 'birthDate', 'availability', 'goal']; // lista blanca por defecto

const studentProfileSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    birthDate: { type: Date, default: null },
    goal: { type: String, trim: true, maxlength: 300, default: '' },
    experienceLevel: { type: String, enum: ['principiante', 'intermedio', 'avanzado'], default: 'principiante' },
    availability: { type: String, trim: true, maxlength: 300, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' }, // observaciones del entrenador (privadas)
    // Campos que el entrenador permite editar al propio alumno.
    studentEditableFields: { type: [String], enum: STUDENT_EDITABLE_FIELDS, default: ['phone', 'availability'] },
    joinedAt: { type: Date, default: Date.now },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
studentProfileSchema.index({ trainer: 1, lastName: 1, firstName: 1 });
studentProfileSchema.index({ firstName: 'text', lastName: 'text' });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

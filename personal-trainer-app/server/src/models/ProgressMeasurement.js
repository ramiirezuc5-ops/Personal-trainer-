import mongoose from 'mongoose';

const valueUnit = { value: { type: Number, min: 0 }, unit: { type: String, trim: true, maxlength: 10 } };

// Cada medición es un registro nuevo y fechado: comparar períodos nunca sobrescribe datos anteriores.
const progressSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    measuredAt: { type: Date, required: true },
    bodyWeight: valueUnit,
    bodyMeasures: { type: [{ _id: false, name: { type: String, trim: true, maxlength: 40, required: true }, ...valueUnit }], default: [] },
    performance: { type: [{ _id: false, exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }, metric: { type: String, trim: true, maxlength: 40, required: true }, ...valueUnit }], default: [] },
    trainerNotes: { type: String, trim: true, maxlength: 1000, default: '' }, // visibles solo para el entrenador
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
progressSchema.index({ student: 1, measuredAt: -1 });

export const ProgressMeasurement = mongoose.model('ProgressMeasurement', progressSchema);

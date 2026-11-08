import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    // Se copian precio y duración al asignar: cambiar el plan después no altera el historial.
    priceSnapshot: { amount: { type: Number, required: true, min: 0 }, currency: { type: String, required: true } },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['pendiente', 'activa', 'vencida', 'cancelada'], default: 'pendiente' },
    discount: { amount: { type: Number, min: 0, default: 0 }, reason: { type: String, maxlength: 200 } },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
membershipSchema.index({ trainer: 1, status: 1, endDate: 1 });
membershipSchema.index({ student: 1, endDate: -1 });

export const Membership = mongoose.model('Membership', membershipSchema);

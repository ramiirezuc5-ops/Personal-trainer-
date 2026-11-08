import mongoose from 'mongoose';
import { DEFAULT_CURRENCY } from '../config/constants.js';

// `source` separa los pagos cargados a mano de los confirmados por un proveedor (Mercado Pago, etapa futura).
// Un pago 'provider' solo puede crearse desde un webhook verificado: nunca desde el formulario del entrenador.
const paymentSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true, match: /^[A-Z]{3}$/ },
    paidAt: { type: Date, required: true },
    method: { type: String, enum: ['efectivo', 'transferencia', 'tarjeta', 'otro'], required: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    discount: { amount: { type: Number, min: 0, default: 0 }, reason: { type: String, maxlength: 200 } },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    source: { type: String, enum: ['manual', 'provider'], default: 'manual' },
    provider: { name: String, externalId: String, verifiedAt: Date },
    status: { type: String, enum: ['registrado', 'anulado'], default: 'registrado' },
    voided: { at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, maxlength: 300 } },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
paymentSchema.index({ trainer: 1, paidAt: -1 });
paymentSchema.index({ student: 1, paidAt: -1 });
paymentSchema.index({ 'provider.name': 1, 'provider.externalId': 1 }, { unique: true, partialFilterExpression: { 'provider.externalId': { $type: 'string' } } });

export const Payment = mongoose.model('Payment', paymentSchema);

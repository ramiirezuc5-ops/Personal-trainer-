import mongoose from 'mongoose';
import { DEFAULT_CURRENCY } from '../config/constants.js';

const membershipPlanSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true, match: /^[A-Z]{3}$/ },
    durationDays: { type: Number, required: true, min: 1, max: 730 },
    sessionsIncluded: { type: Number, min: 0, default: null },
    active: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);

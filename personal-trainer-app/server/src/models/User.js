import mongoose from 'mongoose';
import { ROLES, USER_STATUS } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, index: true },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.PENDING, index: true },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    passwordChangedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
userSchema.set('toJSON', { transform: (_d, r) => { delete r.passwordHash; delete r.failedLoginCount; delete r.lockUntil; delete r.__v; return r; } });

export const User = mongoose.model('User', userSchema);

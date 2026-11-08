import mongoose from 'mongoose';
import { TOKEN_TYPES } from '../config/constants.js';

// Refresh tokens rotativos, invitaciones y recuperación de contraseña. Solo se guarda el hash SHA-256.
const authTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(TOKEN_TYPES), required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    meta: { ip: String, userAgent: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthToken = mongoose.model('AuthToken', authTokenSchema);

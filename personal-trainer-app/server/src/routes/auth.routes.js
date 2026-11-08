import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { changePasswordLimiter, forgotLimiter, loginLimiter, tokenLimiter } from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema } from '../validators/auth.validators.js';

const router = Router();
router.get('/csrf', c.csrf);
router.post('/login', loginLimiter, validate(loginSchema), h(c.login));
router.post('/refresh', h(c.refresh));
router.post('/logout', h(c.logout));
router.get('/me', authenticate, h(c.me));
router.post('/change-password', authenticate, changePasswordLimiter, validate(changePasswordSchema), h(c.changePassword));
router.post('/forgot-password', forgotLimiter, validate(forgotPasswordSchema), h(c.forgotPassword));
router.post('/reset-password', tokenLimiter, validate(resetPasswordSchema), h(c.resetPassword));
export default router;

import { Router } from 'express';
import { loginRequestSchema } from '@hosni/shared';
import * as authController from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../lib/respond.js';
import { loginIpLimiter, loginAccountLimiter, refreshLimiter } from '../middleware/rateLimit.js';

export const authRoutes = Router();

authRoutes.post(
  '/login',
  loginIpLimiter,
  loginAccountLimiter,
  validateBody(loginRequestSchema),
  asyncHandler(authController.login),
);

authRoutes.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
authRoutes.post('/logout', asyncHandler(authController.logout));
authRoutes.get('/me', authenticate, asyncHandler(authController.me));

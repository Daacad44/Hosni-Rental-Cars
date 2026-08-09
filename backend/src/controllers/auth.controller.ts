import type { Request, Response } from 'express';
import type { LoginRequest, LoginResponse } from '@hosni/shared';
import * as authService from '../services/auth.service.js';
import { ok } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { unauthorized } from '../lib/AppError.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/cookies.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginRequest;
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  setAuthCookies(res, accessToken, refreshToken);
  ok<LoginResponse>(res, { user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (!raw) throw unauthorized('No session');
  const { user, accessToken, refreshToken } = await authService.rotateRefreshToken(raw);
  setAuthCookies(res, accessToken, refreshToken);
  ok<LoginResponse>(res, { user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (raw) await authService.revokeRefreshToken(raw);
  clearAuthCookies(res);
  ok(res, { success: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const user = await authService.getAuthUser(actor.id, actor.organizationId);
  ok(res, { user });
}

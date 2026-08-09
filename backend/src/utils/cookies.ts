import type { Response } from 'express';
import { env, isProd } from '../config/env.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const base = {
  httpOnly: true as const,
  secure: isProd,
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN,
  path: '/',
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: env.ACCESS_TOKEN_TTL_SEC * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: env.REFRESH_TOKEN_TTL_SEC * 1000,
    // Refresh cookie is only ever sent to the auth endpoints.
    path: '/api/v1/auth',
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/v1/auth' });
}

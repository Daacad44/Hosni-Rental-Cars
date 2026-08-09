import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@hosni/shared';
import { env } from '../config/env.js';

export interface AccessTokenClaims {
  sub: string; // userId
  organizationId: string;
  branchId: string | null;
  role: Role;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_SEC });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string') throw new Error('Malformed access token');
  return decoded as AccessTokenClaims;
}

/** Raw opaque refresh token (the value stored in the cookie). */
export function generateRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/** Only the hash is stored server-side. */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export const newFamilyId = (): string => crypto.randomUUID();

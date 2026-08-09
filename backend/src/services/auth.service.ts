import type { User } from '@prisma/client';
import type { AuthUser } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, unauthorized } from '../lib/AppError.js';
import { verifyPassword } from '../utils/password.js';
import {
  generateRefreshTokenValue,
  hashToken,
  newFamilyId,
  signAccessToken,
} from '../utils/tokens.js';
import { env } from '../config/env.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

const userInclude = { organization: true, branch: true } as const;

function toAuthUser(
  user: User & {
    organization: { id: string; name: string; timezone: string };
    branch: { id: string; name: string } | null;
  },
): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      timezone: user.organization.timezone,
    },
    branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
  };
}

function accessTokenFor(user: User): string {
  return signAccessToken({
    sub: user.id,
    organizationId: user.organizationId,
    branchId: user.branchId,
    role: user.role,
  });
}

/** Create and persist a fresh refresh token in a new rotation family. */
async function issueRefreshToken(userId: string, organizationId: string): Promise<string> {
  const raw = generateRefreshTokenValue();
  await prisma.refreshToken.create({
    data: {
      userId,
      organizationId,
      tokenHash: hashToken(raw),
      familyId: newFamilyId(),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SEC * 1000),
    },
  });
  return raw;
}

export async function login(email: string, password: string): Promise<{ user: AuthUser } & IssuedTokens> {
  // Look up across organizations by email; email is unique per org, so more
  // than one row can share an address. Verify the password against each.
  const candidates = await prisma.user.findMany({
    where: { email, isActive: true },
    include: userInclude,
  });

  for (const candidate of candidates) {
    if (await verifyPassword(password, candidate.passwordHash)) {
      const accessToken = accessTokenFor(candidate);
      const refreshToken = await issueRefreshToken(candidate.id, candidate.organizationId);
      return { user: toAuthUser(candidate), accessToken, refreshToken };
    }
  }

  throw unauthorized('Invalid email or password');
}

/**
 * Rotate a refresh token: validate it, mint a replacement in the same family,
 * and revoke the old one. A short grace window lets a token that was rotated
 * moments ago still succeed, so two tabs refreshing at once do not collide.
 */
export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ user: AuthUser } & IssuedTokens> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: userInclude } },
  });

  if (!existing || existing.expiresAt < new Date()) {
    throw unauthorized('Session expired');
  }

  const graceMs = env.REFRESH_ROTATION_GRACE_SEC * 1000;
  if (existing.revokedAt && existing.revokedAt.getTime() + graceMs < Date.now()) {
    // Reuse of a token revoked beyond the grace window — treat the whole family
    // as compromised and revoke it.
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Session expired');
  }

  if (!existing.user.isActive) throw unauthorized('Account deactivated');

  const raw = generateRefreshTokenValue();
  const rotated = await prisma.$transaction(async (tx) => {
    if (!existing.revokedAt) {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }
    return tx.refreshToken.create({
      data: {
        userId: existing.userId,
        organizationId: existing.organizationId,
        tokenHash: hashToken(raw),
        familyId: existing.familyId,
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SEC * 1000),
      },
    });
  });

  void rotated;
  return {
    user: toAuthUser(existing.user),
    accessToken: accessTokenFor(existing.user),
    refreshToken: raw,
  };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getAuthUser(userId: string, organizationId: string): Promise<AuthUser> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: userInclude,
  });
  if (!user) throw new AppError('NOT_FOUND', 'User not found');
  return toAuthUser(user);
}

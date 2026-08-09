import { describe, it, expect, beforeAll } from 'vitest';

// Minimal env so config/env does not exit the process during import.
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(40);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(40);
});

describe('token utils', () => {
  it('hashes a token deterministically and irreversibly', async () => {
    const { hashToken } = await import('./tokens.js');
    const raw = 'some-refresh-token-value';
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(raw);
    expect(hashToken(raw)).toHaveLength(64); // sha-256 hex
  });

  it('round-trips access token claims', async () => {
    const { signAccessToken, verifyAccessToken } = await import('./tokens.js');
    const token = signAccessToken({
      sub: 'user-1',
      organizationId: 'org-1',
      branchId: null,
      role: 'AGENT',
    });
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.organizationId).toBe('org-1');
    expect(claims.role).toBe('AGENT');
    expect(claims.branchId).toBeNull();
  });

  it('generates unique refresh token values', async () => {
    const { generateRefreshTokenValue } = await import('./tokens.js');
    expect(generateRefreshTokenValue()).not.toBe(generateRefreshTokenValue());
  });
});

import type { CreateUserRequest, UpdateUserRequest, PaginationQuery, Role } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound, conflict } from '../lib/AppError.js';
import { hashPassword } from '../utils/password.js';
import { writeAudit } from './audit.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
  locale: 'so' | 'en';
  isActive: boolean;
  createdAt: string;
}

function toView(u: {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  branch: { name: string } | null;
  locale: 'so' | 'en';
  isActive: boolean;
  createdAt: Date;
}): UserView {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    branchId: u.branchId,
    branchName: u.branch?.name ?? null,
    locale: u.locale,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listUsers(
  organizationId: string,
  { page, pageSize }: PaginationQuery,
): Promise<{ rows: UserView[]; total: number }> {
  const where = { organizationId };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { rows: rows.map(toView), total };
}

async function assertBranchInOrg(organizationId: string, branchId: string): Promise<void> {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId } });
  if (!branch) throw notFound('Branch not found');
}

export async function createUser(
  actor: AuthContext,
  input: CreateUserRequest,
): Promise<UserView> {
  if (input.branchId) await assertBranchInOrg(actor.organizationId, input.branchId);

  const existing = await prisma.user.findFirst({
    where: { organizationId: actor.organizationId, email: input.email },
  });
  if (existing) throw conflict('A user with this email already exists');

  const user = await prisma.user.create({
    data: {
      organizationId: actor.organizationId,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      branchId: input.branchId ?? null,
      locale: input.locale,
    },
    include: { branch: true },
  });

  await writeAudit({
    organizationId: actor.organizationId,
    actorId: actor.id,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    after: { name: user.name, email: user.email, role: user.role, branchId: user.branchId },
  });

  return toView(user);
}

async function loadUserInOrg(organizationId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: { branch: true },
  });
  if (!user) throw notFound('User not found');
  return user;
}

async function countActiveOwners(organizationId: string, excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      organizationId,
      role: 'OWNER',
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export async function updateUser(
  actor: AuthContext,
  userId: string,
  input: UpdateUserRequest,
): Promise<UserView> {
  const current = await loadUserInOrg(actor.organizationId, userId);

  // Demoting or reassigning the last active OWNER away from OWNER is blocked.
  if (
    current.role === 'OWNER' &&
    input.role &&
    input.role !== 'OWNER' &&
    (await countActiveOwners(actor.organizationId, current.id)) === 0
  ) {
    throw new AppError('CONFLICT', 'Cannot remove the last owner');
  }

  if (input.branchId) await assertBranchInOrg(actor.organizationId, input.branchId);

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.branchId !== undefined) data.branchId = input.branchId;
  if (input.locale !== undefined) data.locale = input.locale;
  if (input.password !== undefined) data.passwordHash = await hashPassword(input.password);

  const updated = await prisma.user.update({
    where: { id: current.id },
    data,
    include: { branch: true },
  });

  const permissionChanged = input.role !== undefined && input.role !== current.role;
  if (permissionChanged || input.branchId !== undefined) {
    await writeAudit({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: current.id,
      before: { role: current.role, branchId: current.branchId },
      after: { role: updated.role, branchId: updated.branchId },
    });
  }

  return toView(updated);
}

/** Deactivate a user and revoke every refresh token they hold. */
export async function deactivateUser(actor: AuthContext, userId: string): Promise<UserView> {
  const current = await loadUserInOrg(actor.organizationId, userId);

  if (current.role === 'OWNER' && (await countActiveOwners(actor.organizationId, current.id)) === 0) {
    throw new AppError('CONFLICT', 'Cannot deactivate the last owner');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: current.id },
      data: { isActive: false },
      include: { branch: true },
    });
    await tx.refreshToken.updateMany({
      where: { userId: current.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: current.id,
        before: { isActive: true },
        after: { isActive: false },
      },
      tx,
    );
    return u;
  });

  return toView(updated);
}

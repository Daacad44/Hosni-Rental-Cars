import type { Prisma } from '@prisma/client';
import type { AlertView } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import type { AuthContext } from '../middleware/authenticate.js';

/** Truncate a moment to a UTC date, the dedup bucket for a day's alerts. */
export function dayBucket(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Raise an alert idempotently. The unique index on
 * (organizationId, type, entityId, raisedOn) means a repeated run on the same
 * day replaces rather than duplicates — no alert storm after a worker outage.
 */
export async function raiseAlert(
  db: Prisma.TransactionClient | typeof prisma,
  params: { organizationId: string; type: string; entityType: string; entityId: string; message: string; raisedOn?: Date },
): Promise<void> {
  const raisedOn = params.raisedOn ?? dayBucket();
  await db.alert.upsert({
    where: {
      organizationId_type_entityId_raisedOn: {
        organizationId: params.organizationId,
        type: params.type,
        entityId: params.entityId,
        raisedOn,
      },
    },
    create: {
      organizationId: params.organizationId,
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      message: params.message,
      raisedOn,
    },
    update: { message: params.message, resolvedAt: null },
  });
}

/** Resolve any unresolved alert of a type/entity not in the still-active set. */
export async function resolveClearedAlerts(
  organizationId: string,
  type: string,
  activeEntityIds: Set<string>,
): Promise<void> {
  const open = await prisma.alert.findMany({
    where: { organizationId, type, resolvedAt: null },
    select: { id: true, entityId: true },
  });
  const toResolve = open.filter((a) => !activeEntityIds.has(a.entityId)).map((a) => a.id);
  if (toResolve.length > 0) {
    await prisma.alert.updateMany({ where: { id: { in: toResolve } }, data: { resolvedAt: new Date() } });
  }
}

export async function listAlerts(actor: AuthContext): Promise<AlertView[]> {
  const alerts = await prisma.alert.findMany({
    where: { organizationId: actor.organizationId, resolvedAt: null },
    orderBy: { raisedOn: 'desc' },
    take: 100,
  });
  return alerts.map((a) => ({
    id: a.id,
    type: a.type,
    entityType: a.entityType,
    entityId: a.entityId,
    message: a.message,
    raisedOn: a.raisedOn.toISOString(),
    resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
  }));
}

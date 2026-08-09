import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface AuditEntry {
  organizationId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Record a money-moving or permission-changing action. Pass the transaction
 * client when the audit must commit atomically with the change it describes.
 */
export async function writeAudit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
    },
  });
}

import { prisma } from '../lib/prisma.js';
import { raiseAlert, resolveClearedAlerts, dayBucket } from './alerts.service.js';
import { markOverdue } from './agreements.service.js';

/**
 * Time-triggered work. Every function is idempotent: derived entirely from the
 * database, keyed on a day bucket, so running it twice on the same data changes
 * nothing on the second run. The worker process schedules these; nothing here
 * runs in a request handler.
 */

const DAY = 86_400_000;

/** Nightly: alert at 30/14/7 days before a document expires, then daily after. */
export async function documentExpiryJob(organizationId: string, now = new Date()): Promise<void> {
  const horizon = new Date(now.getTime() + 30 * DAY);
  const docs = await prisma.vehicleDocument.findMany({
    where: { organizationId, expiryDate: { lte: horizon } },
    select: { id: true, type: true, expiryDate: true, vehicleId: true },
  });
  const active = new Set<string>();
  for (const doc of docs) {
    const days = Math.ceil((doc.expiryDate.getTime() - now.getTime()) / DAY);
    const milestone = days === 30 || days === 14 || days === 7 || days <= 7;
    if (!milestone) continue;
    active.add(doc.id);
    await raiseAlert(prisma, {
      organizationId,
      type: 'DOCUMENT_EXPIRY',
      entityType: 'VehicleDocument',
      entityId: doc.id,
      message: `${doc.type} document expires in ${days} day(s)`,
      raisedOn: dayBucket(now),
    });
  }
  await resolveClearedAlerts(organizationId, 'DOCUMENT_EXPIRY', active);
}

/** Hourly: mark unreturned agreements OVERDUE and alert. */
export async function overdueReturnsJob(organizationId: string, now = new Date()): Promise<void> {
  await markOverdue(organizationId, now);
  const overdue = await prisma.agreement.findMany({
    where: { organizationId, status: 'OVERDUE' },
    select: { id: true, agreementNumber: true },
  });
  const active = new Set<string>();
  for (const a of overdue) {
    active.add(a.id);
    await raiseAlert(prisma, {
      organizationId,
      type: 'OVERDUE_RETURN',
      entityType: 'Agreement',
      entityId: a.id,
      message: `Agreement #${a.agreementNumber} is overdue`,
      raisedOn: dayBucket(now),
    });
  }
  await resolveClearedAlerts(organizationId, 'OVERDUE_RETURN', active);
}

/** Nightly: flag vehicles within the km or day threshold of their next service. */
export async function serviceDueJob(organizationId: string, now = new Date()): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { serviceThresholdKm: true, serviceThresholdDays: true },
  });
  const thresholdKm = org?.serviceThresholdKm ?? 500;
  const thresholdDays = org?.serviceThresholdDays ?? 14;

  // Latest completed maintenance per vehicle carries the next-due figures.
  const completed = await prisma.maintenance.findMany({
    where: { organizationId, status: 'COMPLETED', OR: [{ nextDueAt: { not: null } }, { nextDueOdometer: { not: null } }] },
    orderBy: { completedAt: 'desc' },
  });
  const seen = new Set<string>();
  const active = new Set<string>();
  for (const m of completed) {
    if (seen.has(m.vehicleId)) continue;
    seen.add(m.vehicleId);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: m.vehicleId }, select: { odometer: true, plateNumber: true, deletedAt: true } });
    if (!vehicle || vehicle.deletedAt) continue;
    const dueByDate = m.nextDueAt !== null && m.nextDueAt.getTime() - now.getTime() <= thresholdDays * DAY;
    const dueByKm = m.nextDueOdometer !== null && m.nextDueOdometer - vehicle.odometer <= thresholdKm;
    if (dueByDate || dueByKm) {
      active.add(m.vehicleId);
      await raiseAlert(prisma, {
        organizationId,
        type: 'SERVICE_DUE',
        entityType: 'Vehicle',
        entityId: m.vehicleId,
        message: `${vehicle.plateNumber} is due for service`,
        raisedOn: dayBucket(now),
      });
    }
  }
  await resolveClearedAlerts(organizationId, 'SERVICE_DUE', active);
}

/** Every 15 minutes: release confirmed reservations not claimed within noShowHours. */
export async function noShowJob(organizationId: string, now = new Date()): Promise<number> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { noShowHours: true } });
  const cutoff = new Date(now.getTime() - (org?.noShowHours ?? 4) * 3600_000);
  const res = await prisma.reservation.updateMany({
    where: { organizationId, status: 'CONFIRMED', startAt: { lt: cutoff } },
    data: { status: 'NO_SHOW' },
  });
  return res.count;
}

/** Weekly: expired tokens and resolved alerts older than 90 days. */
export async function cleanupJob(organizationId: string, now = new Date()): Promise<void> {
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY);
  await prisma.refreshToken.deleteMany({ where: { organizationId, expiresAt: { lt: now } } });
  await prisma.alert.deleteMany({ where: { organizationId, resolvedAt: { lt: ninetyDaysAgo } } });
}

/** Run a job for every organization. */
export async function forEachOrg(fn: (organizationId: string) => Promise<unknown>): Promise<void> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) await fn(org.id);
}

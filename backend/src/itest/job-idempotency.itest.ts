import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma.js';
import {
  documentExpiryJob,
  overdueReturnsJob,
  serviceDueJob,
  noShowJob,
  cleanupJob,
} from '../services/jobs.service.js';
import {
  makeTenant,
  makeCustomer,
  makeVehicle,
  makeAgreement,
  makeReservation,
  makeMaintenance,
  uid,
} from './helpers.js';

/**
 * Every time-triggered job is idempotent by construction: it derives state from
 * the database and keys writes on a day bucket, so a second run on the same data
 * changes nothing. This runs all five jobs once to do their work, snapshots the
 * whole world, then re-runs each job and asserts the snapshot is byte-identical.
 * A job that raised a duplicate alert, re-transitioned a row, or re-deleted (and
 * thus mis-counted) would break the snapshot equality.
 */

// A fixed clock so the jobs' date math is deterministic across both runs.
const NOW = new Date('2025-06-15T12:00:00Z');
const DAY = 86_400_000;

async function fullSnapshot(organizationId: string): Promise<string> {
  const [alerts, agreements, reservations, maintenance, tokenCount] = await Promise.all([
    prisma.alert.findMany({
      where: { organizationId },
      orderBy: [{ type: 'asc' }, { entityId: 'asc' }],
      select: { type: true, entityId: true, message: true, raisedOn: true, resolvedAt: true },
    }),
    prisma.agreement.findMany({ where: { organizationId }, orderBy: { id: 'asc' }, select: { id: true, status: true } }),
    prisma.reservation.findMany({ where: { organizationId }, orderBy: { id: 'asc' }, select: { id: true, status: true } }),
    prisma.maintenance.findMany({ where: { organizationId }, orderBy: { id: 'asc' }, select: { id: true, status: true } }),
    prisma.refreshToken.count({ where: { organizationId } }),
  ]);
  return JSON.stringify({ alerts, agreements, reservations, maintenance, tokenCount });
}

async function runAll(organizationId: string): Promise<void> {
  await documentExpiryJob(organizationId, NOW);
  await overdueReturnsJob(organizationId, NOW);
  await serviceDueJob(organizationId, NOW);
  await noShowJob(organizationId, NOW);
  await cleanupJob(organizationId, NOW);
}

describe('job idempotency', () => {
  let organizationId: string;
  let branchId: string;

  beforeEach(async () => {
    ({ organizationId, branchId } = await makeTenant('J'));
    const customerId = await makeCustomer(organizationId);

    // documentExpiry: a document expiring in 3 days → within the alert horizon.
    const vehicle = await makeVehicle(organizationId, branchId, { odometer: 20_000 });
    await prisma.vehicleDocument.create({
      data: {
        organizationId,
        vehicleId: vehicle,
        type: 'INSURANCE',
        number: uid('DOC'),
        issueDate: new Date('2025-01-01T00:00:00Z'),
        expiryDate: new Date(NOW.getTime() + 3 * DAY),
      },
    });

    // overdueReturns: an OPEN agreement whose planned return is in the past.
    await makeAgreement(organizationId, branchId, customerId, vehicle, {
      status: 'OPEN',
      startAt: new Date('2025-06-01T00:00:00Z'),
      endAt: new Date('2025-06-10T00:00:00Z'),
    });

    // serviceDue: a completed service whose next-due odometer is within threshold.
    const serviceVehicle = await makeVehicle(organizationId, branchId, { odometer: 49_600 });
    await makeMaintenance(organizationId, serviceVehicle, {
      status: 'COMPLETED',
      completedAt: new Date('2025-01-01T00:00:00Z'),
      nextDueOdometer: 50_000, // 400 km away, under the 500 km default threshold
    });

    // noShow: a CONFIRMED reservation whose pickup passed more than noShowHours ago.
    await makeReservation(organizationId, branchId, customerId, {
      status: 'CONFIRMED',
      startAt: new Date('2025-06-15T00:00:00Z'),
      endAt: new Date('2025-06-18T00:00:00Z'),
      vehicleId: null,
    });

    // cleanup: an expired refresh token and a long-resolved alert, both stale.
    const user = await prisma.user.create({
      data: {
        organizationId,
        branchId,
        name: 'Idempotent User',
        email: uid('email'),
        passwordHash: 'x',
        role: 'AGENT',
      },
    });
    await prisma.refreshToken.create({
      data: {
        organizationId,
        userId: user.id,
        tokenHash: uid('hash'),
        familyId: uid('fam'),
        expiresAt: new Date('2025-01-01T00:00:00Z'),
      },
    });
    await prisma.alert.create({
      data: {
        organizationId,
        type: 'STALE',
        entityType: 'Thing',
        entityId: uid('e'),
        message: 'old',
        raisedOn: new Date('2025-01-01T00:00:00Z'),
        resolvedAt: new Date(NOW.getTime() - 100 * DAY),
      },
    });
  });

  it('the first run does real work, and every second run changes nothing', async () => {
    await runAll(organizationId);

    // Guard against a vacuous test: prove the first run actually did each job's work.
    const alertTypes = (
      await prisma.alert.findMany({ where: { organizationId }, select: { type: true } })
    ).map((a) => a.type);
    expect(alertTypes).toContain('DOCUMENT_EXPIRY');
    expect(alertTypes).toContain('OVERDUE_RETURN');
    expect(alertTypes).toContain('SERVICE_DUE');
    expect(alertTypes).not.toContain('STALE'); // the long-resolved alert was cleaned up
    expect(await prisma.agreement.count({ where: { organizationId, status: 'OVERDUE' } })).toBe(1);
    expect(await prisma.reservation.count({ where: { organizationId, status: 'NO_SHOW' } })).toBe(1);
    expect(await prisma.refreshToken.count({ where: { organizationId } })).toBe(0);

    const baseline = await fullSnapshot(organizationId);

    // Re-run each job on its own; none may change the world.
    const jobs: Array<[string, () => Promise<unknown>]> = [
      ['documentExpiry', () => documentExpiryJob(organizationId, NOW)],
      ['overdueReturns', () => overdueReturnsJob(organizationId, NOW)],
      ['serviceDue', () => serviceDueJob(organizationId, NOW)],
      ['noShow', () => noShowJob(organizationId, NOW)],
      ['cleanup', () => cleanupJob(organizationId, NOW)],
    ];
    for (const [name, run] of jobs) {
      await run();
      expect(await fullSnapshot(organizationId), `${name} second run mutated state`).toBe(baseline);
    }

    // And a full second pass, for good measure, is also a no-op.
    await runAll(organizationId);
    expect(await fullSnapshot(organizationId)).toBe(baseline);
  });

  it('noShow reports zero transitions on its second run', async () => {
    const first = await noShowJob(organizationId, NOW);
    const second = await noShowJob(organizationId, NOW);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });
});

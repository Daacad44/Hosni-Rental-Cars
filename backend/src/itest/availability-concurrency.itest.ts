import { describe, it, expect, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { confirmReservation } from '../services/reservations.service.js';
import { isExclusionViolation } from '../services/availability.service.js';
import { AppError } from '../lib/AppError.js';
import { principal, makeTenant, makeCustomer, makeVehicle, makeReservation, type TestUser } from './helpers.js';

/**
 * Availability under concurrency. Two agents confirm the LAST free vehicle at
 * the same instant for the same window. Exactly one must win; the other must be
 * turned away with OVERLAPPING_RESERVATION. A double-booked car is the failure
 * this whole system exists to prevent.
 *
 * This race is real, not theoretical: the second test below proves that the
 * application's own check-then-write — a SELECT for a clash followed by an
 * UPDATE — lets BOTH writers through at READ COMMITTED, because neither sees the
 * other's uncommitted row. The database's exclusion constraint is the only
 * thing that resolves the tie. Remove `Reservation_no_overlap` and a naive
 * implementation double-books; keep it and exactly one write survives.
 */

describe('availability under concurrency', () => {
  let owner: TestUser;
  let organizationId: string;
  let branchId: string;
  let vehicleId: string;
  let r1: string;
  let r2: string;

  beforeEach(async () => {
    ({ organizationId, branchId } = await makeTenant('C'));
    owner = principal({ organizationId, role: 'OWNER', branchId });
    const customer = await makeCustomer(organizationId);
    vehicleId = await makeVehicle(organizationId, branchId);
    // Two pending reservations, same vehicle, identical (overlapping) window.
    const window = { startAt: new Date('2025-03-01T00:00:00Z'), endAt: new Date('2025-03-05T00:00:00Z') };
    r1 = await makeReservation(organizationId, branchId, customer, { vehicleId, status: 'PENDING', ...window });
    r2 = await makeReservation(organizationId, branchId, customer, { vehicleId, status: 'PENDING', ...window });
  });

  it('two simultaneous confirmations yield exactly one winner and one OVERLAPPING_RESERVATION', async () => {
    const results = await Promise.allSettled([
      confirmReservation(owner, r1),
      confirmReservation(owner, r2),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('OVERLAPPING_RESERVATION');

    // The database agrees: exactly one confirmed reservation holds the vehicle.
    const confirmed = await prisma.reservation.count({
      where: { organizationId, vehicleId, status: 'CONFIRMED' },
    });
    expect(confirmed).toBe(1);
  });

  it('proves the race: the app-level check alone passes twice; the DB constraint breaks the tie', async () => {
    // Two concurrent transactions do exactly what a NON-transactional / naive
    // implementation does — read for a clash, find none, then write CONFIRMED —
    // with NO assertVehicleFree serialization. Both SELECTs see a free vehicle;
    // only the exclusion constraint stops the double booking.
    const naiveConfirm = (reservationId: string) =>
      prisma.$transaction(async (tx) => {
        const clash = await tx.reservation.findFirst({
          where: {
            organizationId,
            vehicleId,
            status: { in: ['CONFIRMED', 'CONVERTED'] },
            startAt: { lt: new Date('2025-03-05T00:00:00Z') },
            endAt: { gt: new Date('2025-03-01T00:00:00Z') },
          },
          select: { id: true },
        });
        // The naive check finds nothing for either writer — that is the bug the
        // constraint backstops. We do NOT branch on `clash`; we write regardless.
        void clash;
        await tx.reservation.update({ where: { id: reservationId }, data: { status: 'CONFIRMED' } });
      });

    const results = await Promise.allSettled([naiveConfirm(r1), naiveConfirm(r2)]);
    const rejected = results.filter((r) => r.status === 'rejected');

    // Without the DB constraint both would commit (double-book). With it, one fails.
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(
      isExclusionViolation(reason) ||
        (reason instanceof Prisma.PrismaClientKnownRequestError && reason.code === 'P2034'),
    ).toBe(true);

    const confirmed = await prisma.reservation.count({
      where: { organizationId, vehicleId, status: 'CONFIRMED' },
    });
    expect(confirmed).toBe(1);
  });
});

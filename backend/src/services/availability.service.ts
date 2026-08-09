import type { Prisma } from '@prisma/client';
import { AppError } from '../lib/AppError.js';

/**
 * The overlap predicate, stated once: two half-open intervals overlap iff each
 * starts before the other ends. Pure and unit-tested.
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Availability gate, run INSIDE the write transaction — never before it. A
 * check that passed a second ago is not a guarantee, so the caller holds a
 * transaction and the database's exclusion constraint is the final backstop.
 *
 * Today it rejects on an overlapping active reservation; the agreements and
 * maintenance modules extend it with their own overlap checks against the same
 * window. Throws OVERLAPPING_RESERVATION when the vehicle is not free.
 */
export async function assertVehicleFree(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    vehicleId: string;
    startAt: Date;
    endAt: Date;
    excludeReservationId?: string;
  },
): Promise<void> {
  const clash = await tx.reservation.findFirst({
    where: {
      organizationId: params.organizationId,
      vehicleId: params.vehicleId,
      status: { in: ['CONFIRMED', 'CONVERTED'] },
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      ...(params.excludeReservationId ? { id: { not: params.excludeReservationId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new AppError('OVERLAPPING_RESERVATION', 'The vehicle is already booked for this period');

  // Extension points wired up by later modules:
  // - agreements: reject on an overlapping open agreement for this vehicle
  // - maintenance: reject on an overlapping scheduled maintenance window
}

/** Postgres exclusion-violation code, mapped to OVERLAPPING_RESERVATION. */
export function isExclusionViolation(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  // Prisma surfaces the raw Postgres SQLSTATE 23P01 on constraint failure.
  if (code === '23P01') return true;
  const message = (err as { message?: string }).message ?? '';
  return message.includes('Reservation_no_overlap') || message.includes('exclusion');
}

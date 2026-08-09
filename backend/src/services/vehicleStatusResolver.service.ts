import { prisma } from '../lib/prisma.js';
import type { StatusInputs } from './vehicleStatus.service.js';

/**
 * Resolve the live status inputs for a set of vehicles — whether each currently
 * has an open agreement or an active confirmed reservation. Batched to avoid
 * N+1 queries on list views. Maintenance is added by that module.
 */
type ResolvedInputs = Pick<StatusInputs, 'hasActiveAgreement' | 'hasActiveReservation' | 'hasOpenMaintenance'>;

export async function resolveStatusInputs(
  organizationId: string,
  vehicleIds: string[],
  now = new Date(),
): Promise<Map<string, ResolvedInputs>> {
  const result = new Map<string, ResolvedInputs>();
  if (vehicleIds.length === 0) return result;

  const [agreements, reservations, maintenance] = await Promise.all([
    prisma.agreement.findMany({
      where: {
        organizationId,
        vehicleId: { in: vehicleIds },
        status: { in: ['OPEN', 'OVERDUE'] },
      },
      select: { vehicleId: true },
    }),
    prisma.reservation.findMany({
      where: {
        organizationId,
        vehicleId: { in: vehicleIds },
        status: 'CONFIRMED',
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { vehicleId: true },
    }),
    prisma.maintenance.findMany({
      where: {
        organizationId,
        vehicleId: { in: vehicleIds },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        scheduledStart: { lte: now },
        scheduledEnd: { gt: now },
      },
      select: { vehicleId: true },
    }),
  ]);

  const rented = new Set(agreements.map((a) => a.vehicleId));
  const reserved = new Set(reservations.map((r) => r.vehicleId).filter((v): v is string => v !== null));
  const maint = new Set(maintenance.map((m) => m.vehicleId));

  for (const id of vehicleIds) {
    result.set(id, {
      hasActiveAgreement: rented.has(id),
      hasActiveReservation: reserved.has(id),
      hasOpenMaintenance: maint.has(id),
    });
  }
  return result;
}

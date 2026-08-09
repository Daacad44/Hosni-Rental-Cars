import type { QuoteRequest, PricingBreakdown } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { resolveRateValues } from './rateCards.service.js';
import { priceRental } from './pricing.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

/**
 * Price a hypothetical range. Resolves the rates in force at pickup, then runs
 * the pure pricing function with the organisation's grace period and VAT. Never
 * persists anything (§5.4).
 */
export async function quote(actor: AuthContext, input: QuoteRequest): Promise<PricingBreakdown> {
  const [vehicle, org] = await Promise.all([
    prisma.vehicle.findFirst({
      where: { id: input.vehicleId, organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, category: true, branchId: true },
    }),
    prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { graceMinutes: true, vatRate: true },
    }),
  ]);
  if (!vehicle) throw notFound('Vehicle not found');
  if (actor.role === 'AGENT' && vehicle.branchId !== actor.branchId) throw notFound('Vehicle not found');

  const startAt = new Date(input.startAt);
  const rates = await resolveRateValues(actor.organizationId, vehicle, startAt);

  return priceRental({
    startAt,
    endAt: new Date(input.endAt),
    rates,
    drivenKm: input.drivenKm ?? null,
    graceMinutes: org?.graceMinutes ?? 59,
    vatRatePercent: org ? org.vatRate.toFixed(2) : '0.00',
  });
}

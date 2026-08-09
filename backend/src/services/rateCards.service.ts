import { Prisma } from '@prisma/client';
import type { RateCardRequest, RateCardView, RateValues } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/AppError.js';
import type { AuthContext } from '../middleware/authenticate.js';

type RateCardRow = Prisma.RateCardGetPayload<object>;

function dec(v: Prisma.Decimal): string {
  return v.toFixed(2);
}
function decN(v: Prisma.Decimal | null): string | null {
  return v === null ? null : v.toFixed(2);
}

export function toRateValues(card: RateCardRow): RateValues {
  return {
    dailyRate: dec(card.dailyRate),
    weeklyRate: decN(card.weeklyRate),
    monthlyRate: decN(card.monthlyRate),
    includedKmPerDay: card.includedKmPerDay,
    extraKmRate: dec(card.extraKmRate),
    depositAmount: dec(card.depositAmount),
    lateHourRate: dec(card.lateHourRate),
  };
}

function toView(card: RateCardRow): RateCardView {
  return {
    id: card.id,
    vehicleId: card.vehicleId,
    category: card.category,
    dailyRate: dec(card.dailyRate),
    weeklyRate: decN(card.weeklyRate),
    monthlyRate: decN(card.monthlyRate),
    includedKmPerDay: card.includedKmPerDay,
    extraKmRate: dec(card.extraKmRate),
    depositAmount: dec(card.depositAmount),
    lateHourRate: dec(card.lateHourRate),
    effectiveFrom: card.effectiveFrom.toISOString(),
    effectiveTo: card.effectiveTo ? card.effectiveTo.toISOString() : null,
  };
}

/**
 * Resolve the rate values in force for a vehicle at a moment in time. A
 * vehicle-specific override wins over its category card; among candidates the
 * one with the latest effectiveFrom that is currently in effect is chosen.
 * Impure (reads the database) — the pure calculation consumes its output.
 */
export async function resolveRateValues(
  organizationId: string,
  vehicle: { id: string; category: string },
  at: Date,
): Promise<RateValues> {
  const effective: Prisma.RateCardWhereInput = {
    organizationId,
    effectiveFrom: { lte: at },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
  };

  const override = await prisma.rateCard.findFirst({
    where: { ...effective, vehicleId: vehicle.id },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (override) return toRateValues(override);

  const categoryCard = await prisma.rateCard.findFirst({
    where: { ...effective, vehicleId: null, category: vehicle.category },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (categoryCard) return toRateValues(categoryCard);

  throw new AppError('NOT_FOUND', 'No rate card is configured for this vehicle');
}

export async function listRateCards(actor: AuthContext): Promise<RateCardView[]> {
  const cards = await prisma.rateCard.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ category: 'asc' }, { effectiveFrom: 'desc' }],
  });
  return cards.map(toView);
}

function toData(input: RateCardRequest) {
  return {
    category: input.category,
    dailyRate: new Prisma.Decimal(input.dailyRate),
    weeklyRate: input.weeklyRate ? new Prisma.Decimal(input.weeklyRate) : null,
    monthlyRate: input.monthlyRate ? new Prisma.Decimal(input.monthlyRate) : null,
    includedKmPerDay: input.includedKmPerDay,
    extraKmRate: new Prisma.Decimal(input.extraKmRate),
    depositAmount: new Prisma.Decimal(input.depositAmount),
    lateHourRate: new Prisma.Decimal(input.lateHourRate),
    effectiveFrom: new Date(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
  };
}

export async function createRateCard(
  actor: AuthContext,
  input: RateCardRequest,
  vehicleId?: string | null,
): Promise<RateCardView> {
  const card = await prisma.rateCard.create({
    data: { organizationId: actor.organizationId, vehicleId: vehicleId ?? null, ...toData(input) },
  });
  return toView(card);
}

async function loadCard(actor: AuthContext, id: string): Promise<RateCardRow> {
  const card = await prisma.rateCard.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!card) throw notFound('Rate card not found');
  return card;
}

export async function updateRateCard(
  actor: AuthContext,
  id: string,
  input: RateCardRequest,
): Promise<RateCardView> {
  await loadCard(actor, id);
  const card = await prisma.rateCard.update({ where: { id }, data: toData(input) });
  return toView(card);
}

export async function deleteRateCard(actor: AuthContext, id: string): Promise<void> {
  await loadCard(actor, id);
  await prisma.rateCard.delete({ where: { id } });
}

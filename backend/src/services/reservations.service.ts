import { Prisma } from '@prisma/client';
import type {
  CreateReservationRequest,
  ReservationFilters,
  ReservationStatus,
  ReservationListItem,
  ReservationDetail,
  AvailabilityQuery,
  AvailableVehicle,
  PricingBreakdown,
  RateValues,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound, conflict } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import { resolveRateValues } from './rateCards.service.js';
import { priceRental } from './pricing.service.js';
import { assertVehicleFree, isExclusionViolation } from './availability.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

type ReservationRow = Prisma.ReservationGetPayload<object>;

const ALLOWED: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CONVERTED', 'CANCELLED', 'NO_SHOW'],
  CONVERTED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function assertTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new AppError('CONFLICT', `Cannot move a reservation from ${from} to ${to}`);
  }
}

function branchScope(actor: AuthContext, requested?: string): string | undefined {
  if (actor.role === 'AGENT') return actor.branchId ?? '__none__';
  return requested;
}

async function orgSettings(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { graceMinutes: true, vatRate: true },
  });
  return { grace: org?.graceMinutes ?? 59, vat: org ? org.vatRate.toFixed(2) : '0.00' };
}

/** Price a reservation window from the rates in force at pickup. */
async function computeQuote(
  organizationId: string,
  categoryOrVehicle: { vehicleId: string | null; category: string },
  startAt: Date,
  endAt: Date,
): Promise<{ breakdown: PricingBreakdown; rates: RateValues }> {
  const rates = await resolveRateValues(
    organizationId,
    { id: categoryOrVehicle.vehicleId ?? '', category: categoryOrVehicle.category },
    startAt,
  );
  const { grace, vat } = await orgSettings(organizationId);
  const breakdown = priceRental({ startAt, endAt, rates, graceMinutes: grace, vatRatePercent: vat });
  return { breakdown, rates };
}

async function loadReservation(actor: AuthContext, id: string): Promise<ReservationRow> {
  const reservation = await prisma.reservation.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!reservation) throw notFound('Reservation not found');
  if (actor.role === 'AGENT' && reservation.branchId !== actor.branchId) throw notFound('Reservation not found');
  return reservation;
}

async function toDetail(r: ReservationRow): Promise<ReservationDetail> {
  const [customer, vehicle] = await Promise.all([
    prisma.customer.findUnique({ where: { id: r.customerId }, select: { fullName: true } }),
    r.vehicleId
      ? prisma.vehicle.findUnique({ where: { id: r.vehicleId }, select: { plateNumber: true } })
      : Promise.resolve(null),
  ]);
  return {
    id: r.id,
    customerId: r.customerId,
    customerName: customer?.fullName ?? '—',
    category: r.category,
    vehicleId: r.vehicleId,
    vehiclePlate: vehicle?.plateNumber ?? null,
    branchId: r.branchId,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    status: r.status,
    quotedTotal: r.quotedTotal.toFixed(2),
    quotedDeposit: r.quotedDeposit.toFixed(2),
    breakdown: r.quoteBreakdown as unknown as PricingBreakdown,
  };
}

/**
 * Guard a customer for booking. A blocked customer is always refused. An expired
 * licence is refused unless a manager overrides, which is audit-logged.
 */
async function guardCustomer(
  actor: AuthContext,
  customerId: string,
  plannedReturn: Date,
  overrideLicence: boolean,
): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!customer) throw notFound('Customer not found');
  if (customer.isBlocked) throw new AppError('CUSTOMER_BLOCKED', 'This customer is blocked');

  if (customer.licenceExpiry && customer.licenceExpiry.getTime() < plannedReturn.getTime()) {
    const isManager = actor.role === 'OWNER' || actor.role === 'MANAGER';
    if (!(overrideLicence && isManager)) {
      throw new AppError('LICENCE_EXPIRED', 'The licence expires before the planned return date');
    }
    await writeAudit({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'LICENCE_EXPIRY_OVERRIDE',
      entityType: 'Customer',
      entityId: customerId,
      after: { plannedReturn: plannedReturn.toISOString() },
    });
  }
}

async function resolveVehicleForBooking(
  actor: AuthContext,
  vehicleId: string,
): Promise<{ id: string; category: string; branchId: string }> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, category: true, branchId: true, isOutOfService: true },
  });
  if (!vehicle) throw notFound('Vehicle not found');
  if (actor.role === 'AGENT' && vehicle.branchId !== actor.branchId) throw notFound('Vehicle not found');
  if (vehicle.isOutOfService) throw new AppError('VEHICLE_UNAVAILABLE', 'The vehicle is out of service');
  return { id: vehicle.id, category: vehicle.category, branchId: vehicle.branchId };
}

export async function createReservation(
  actor: AuthContext,
  input: CreateReservationRequest,
): Promise<ReservationDetail> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  await guardCustomer(actor, input.customerId, endAt, input.overrideLicence ?? false);

  let category = input.category;
  let vehicleId: string | null = null;
  let branchId = branchScope(actor) ?? '';

  if (input.vehicleId) {
    const vehicle = await resolveVehicleForBooking(actor, input.vehicleId);
    vehicleId = vehicle.id;
    category = vehicle.category;
    branchId = vehicle.branchId;
  } else if (!branchId) {
    // A category-only reservation needs a branch; use the actor's when present.
    branchId = actor.branchId ?? '';
    if (!branchId) throw conflict('A branch is required for a category reservation');
  }

  const { breakdown, rates } = await computeQuote(
    actor.organizationId,
    { vehicleId, category },
    startAt,
    endAt,
  );

  const confirm = Boolean(input.confirm && vehicleId);
  const status: ReservationStatus = confirm ? 'CONFIRMED' : 'PENDING';

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      if (confirm && vehicleId) {
        await assertVehicleFree(tx, { organizationId: actor.organizationId, vehicleId, startAt, endAt });
      }
      return tx.reservation.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          customerId: input.customerId,
          category,
          vehicleId,
          startAt,
          endAt,
          status,
          quotedTotal: new Prisma.Decimal(breakdown.total),
          quotedDeposit: new Prisma.Decimal(breakdown.deposit),
          rateValues: rates as unknown as Prisma.InputJsonValue,
          quoteBreakdown: breakdown as unknown as Prisma.InputJsonValue,
          createdById: actor.id,
        },
      });
    });
    return toDetail(reservation);
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new AppError('OVERLAPPING_RESERVATION', 'The vehicle is already booked for this period');
    }
    throw err;
  }
}

export async function confirmReservation(
  actor: AuthContext,
  id: string,
  assignVehicleId?: string,
): Promise<ReservationDetail> {
  const reservation = await loadReservation(actor, id);
  assertTransition(reservation.status, 'CONFIRMED');

  const vehicleId = assignVehicleId ?? reservation.vehicleId;
  if (!vehicleId) throw conflict('A vehicle must be assigned before confirming');

  const vehicle = await resolveVehicleForBooking(actor, vehicleId);
  // Re-price if the vehicle changed the category/rates.
  const needsReprice = vehicle.id !== reservation.vehicleId;
  const quote = needsReprice
    ? await computeQuote(actor.organizationId, { vehicleId: vehicle.id, category: vehicle.category }, reservation.startAt, reservation.endAt)
    : null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await assertVehicleFree(tx, {
        organizationId: actor.organizationId,
        vehicleId: vehicle.id,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        excludeReservationId: reservation.id,
      });
      return tx.reservation.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          vehicleId: vehicle.id,
          category: vehicle.category,
          ...(quote
            ? {
                quotedTotal: new Prisma.Decimal(quote.breakdown.total),
                quotedDeposit: new Prisma.Decimal(quote.breakdown.deposit),
                rateValues: quote.rates as unknown as Prisma.InputJsonValue,
                quoteBreakdown: quote.breakdown as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
    });
    return toDetail(updated);
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new AppError('OVERLAPPING_RESERVATION', 'The vehicle is already booked for this period');
    }
    throw err;
  }
}

export async function cancelReservation(actor: AuthContext, id: string): Promise<ReservationDetail> {
  const reservation = await loadReservation(actor, id);
  assertTransition(reservation.status, 'CANCELLED');
  const updated = await prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
  return toDetail(updated);
}

/** Used by the no-show job to release an unclaimed confirmed reservation. */
export async function markNoShow(organizationId: string, id: string): Promise<void> {
  await prisma.reservation.updateMany({
    where: { id, organizationId, status: 'CONFIRMED' },
    data: { status: 'NO_SHOW' },
  });
}

export async function listReservations(
  actor: AuthContext,
  filters: ReservationFilters,
): Promise<{ rows: ReservationListItem[]; total: number }> {
  const scopedBranch = branchScope(actor, filters.branchId);
  const where: Prisma.ReservationWhereInput = {
    organizationId: actor.organizationId,
    ...(scopedBranch ? { branchId: scopedBranch } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? {
          startAt: {
            ...(filters.to ? { lt: new Date(filters.to) } : {}),
          },
          endAt: {
            ...(filters.from ? { gt: new Date(filters.from) } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { startAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const vehicleIds = rows.map((r) => r.vehicleId).filter((v): v is string => v !== null);
  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, fullName: true } }),
    prisma.vehicle.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, plateNumber: true } }),
  ]);
  const customerName = new Map(customers.map((c) => [c.id, c.fullName]));
  const vehiclePlate = new Map(vehicles.map((v) => [v.id, v.plateNumber]));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      customerName: customerName.get(r.customerId) ?? '—',
      category: r.category,
      vehiclePlate: r.vehicleId ? (vehiclePlate.get(r.vehicleId) ?? null) : null,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      status: r.status,
      quotedTotal: r.quotedTotal.toFixed(2),
    })),
    total,
  };
}

export async function getReservation(actor: AuthContext, id: string): Promise<ReservationDetail> {
  return toDetail(await loadReservation(actor, id));
}

/** Vehicles free for the window: no overlapping active reservation. */
export async function availableVehicles(
  actor: AuthContext,
  query: AvailabilityQuery,
): Promise<AvailableVehicle[]> {
  const from = new Date(query.from);
  const to = new Date(query.to);
  const scopedBranch = branchScope(actor, query.branchId);

  const busy = await prisma.reservation.findMany({
    where: {
      organizationId: actor.organizationId,
      status: { in: ['CONFIRMED', 'CONVERTED'] },
      vehicleId: { not: null },
      startAt: { lt: to },
      endAt: { gt: from },
    },
    select: { vehicleId: true },
  });
  const busyIds = busy.map((b) => b.vehicleId).filter((v): v is string => v !== null);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      organizationId: actor.organizationId,
      deletedAt: null,
      isOutOfService: false,
      ...(query.category ? { category: query.category } : {}),
      ...(scopedBranch ? { branchId: scopedBranch } : {}),
      ...(busyIds.length ? { id: { notIn: busyIds } } : {}),
    },
    include: { branch: { select: { name: true } } },
    orderBy: { plateNumber: 'asc' },
    take: 200,
  });

  return vehicles.map((v) => ({
    id: v.id,
    plateNumber: v.plateNumber,
    make: v.make,
    model: v.model,
    category: v.category,
    branchName: v.branch.name,
  }));
}

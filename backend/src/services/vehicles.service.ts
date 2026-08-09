import { Prisma } from '@prisma/client';
import type {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleFilters,
  VehicleDetail,
  VehicleListItem,
  OdometerUpdateRequest,
  OutOfServiceRequest,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound, conflict } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import { deriveVehicleStatus } from './vehicleStatus.service.js';
import { resolveStatusInputs } from './vehicleStatusResolver.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

/**
 * Branch scope for AGENT is mandatory: an agent only ever sees their own
 * branch. Other roles may optionally filter by a branch. Organisation scope is
 * always applied by the caller — it is the security boundary.
 */
function branchScope(actor: AuthContext, requestedBranchId?: string): string | undefined {
  if (actor.role === 'AGENT') return actor.branchId ?? '__none__';
  return requestedBranchId;
}

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

type VehicleRow = Prisma.VehicleGetPayload<{ include: { branch: true } }>;

function toDetail(
  v: VehicleRow,
  extra: { hasActiveAgreement?: boolean; hasActiveReservation?: boolean } = {},
): VehicleDetail {
  return {
    id: v.id,
    plateNumber: v.plateNumber,
    vin: v.vin,
    make: v.make,
    model: v.model,
    year: v.year,
    category: v.category,
    transmission: v.transmission,
    fuelType: v.fuelType,
    seats: v.seats,
    colour: v.colour,
    odometer: v.odometer,
    acquisitionCost: money(v.acquisitionCost),
    acquisitionDate: v.acquisitionDate.toISOString(),
    branchId: v.branchId,
    branchName: v.branch.name,
    status: deriveVehicleStatus({ isOutOfService: v.isOutOfService, ...extra }),
    isOutOfService: v.isOutOfService,
    outOfServiceReason: v.outOfServiceReason,
    createdAt: v.createdAt.toISOString(),
  };
}

async function assertBranchInOrg(organizationId: string, branchId: string): Promise<void> {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId } });
  if (!branch) throw notFound('Branch not found');
}

export async function listVehicles(
  actor: AuthContext,
  filters: VehicleFilters,
): Promise<{ rows: VehicleListItem[]; total: number }> {
  const scopedBranch = branchScope(actor, filters.branchId);

  const where: Prisma.VehicleWhereInput = {
    organizationId: actor.organizationId,
    deletedAt: null,
    ...(scopedBranch ? { branchId: scopedBranch } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.q
      ? {
          OR: [
            { plateNumber: { contains: filters.q, mode: 'insensitive' } },
            { vin: { contains: filters.q, mode: 'insensitive' } },
            { make: { contains: filters.q, mode: 'insensitive' } },
            { model: { contains: filters.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filters.docsExpiringDays
      ? {
          documents: {
            some: {
              expiryDate: {
                lte: new Date(Date.now() + filters.docsExpiringDays * 86_400_000),
              },
            },
          },
        }
      : {}),
  };

  // Status is derived. Only the manual override is representable in the database
  // today; RENTED / RESERVED / MAINTENANCE become filterable when those modules
  // add their records. Until then those statuses correctly match nothing.
  if (filters.status === 'OUT_OF_SERVICE') where.isOutOfService = true;
  else if (filters.status === 'AVAILABLE') where.isOutOfService = false;
  else if (filters.status === 'RENTED' || filters.status === 'RESERVED' || filters.status === 'MAINTENANCE') {
    where.id = '__none__';
  }

  const expiringBefore = new Date(Date.now() + 30 * 86_400_000);

  const [rows, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: {
        branch: true,
        _count: { select: { photos: true } },
        documents: { where: { expiryDate: { lte: expiringBefore } }, select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.vehicle.count({ where }),
  ]);

  const statusInputs = await resolveStatusInputs(
    actor.organizationId,
    rows.map((v) => v.id),
  );

  const list: VehicleListItem[] = rows.map((v) => ({
    id: v.id,
    plateNumber: v.plateNumber,
    make: v.make,
    model: v.model,
    year: v.year,
    category: v.category,
    branchId: v.branchId,
    branchName: v.branch.name,
    status: deriveVehicleStatus({ isOutOfService: v.isOutOfService, ...(statusInputs.get(v.id) ?? {}) }),
    odometer: v.odometer,
    photoCount: v._count.photos,
    hasExpiringDocs: v.documents.length > 0,
  }));

  return { rows: list, total };
}

async function loadVehicle(actor: AuthContext, id: string): Promise<VehicleRow> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, organizationId: actor.organizationId, deletedAt: null },
    include: { branch: true },
  });
  if (!vehicle) throw notFound('Vehicle not found');
  if (actor.role === 'AGENT' && vehicle.branchId !== actor.branchId) throw notFound('Vehicle not found');
  return vehicle;
}

export async function getVehicle(actor: AuthContext, id: string): Promise<VehicleDetail> {
  const vehicle = await loadVehicle(actor, id);
  const inputs = await resolveStatusInputs(actor.organizationId, [vehicle.id]);
  return toDetail(vehicle, inputs.get(vehicle.id) ?? {});
}

export async function createVehicle(
  actor: AuthContext,
  input: CreateVehicleRequest,
): Promise<VehicleDetail> {
  await assertBranchInOrg(actor.organizationId, input.branchId);

  const clash = await prisma.vehicle.findFirst({
    where: {
      organizationId: actor.organizationId,
      plateNumber: input.plateNumber,
      deletedAt: null,
    },
  });
  if (clash) throw conflict('A vehicle with this plate number already exists');

  const vehicle = await prisma.vehicle.create({
    data: {
      organizationId: actor.organizationId,
      branchId: input.branchId,
      plateNumber: input.plateNumber,
      vin: input.vin,
      make: input.make,
      model: input.model,
      year: input.year,
      category: input.category,
      transmission: input.transmission,
      fuelType: input.fuelType,
      seats: input.seats,
      colour: input.colour,
      odometer: input.odometer,
      acquisitionCost: new Prisma.Decimal(input.acquisitionCost),
      acquisitionDate: new Date(input.acquisitionDate),
    },
    include: { branch: true },
  });

  return toDetail(vehicle);
}

export async function updateVehicle(
  actor: AuthContext,
  id: string,
  input: UpdateVehicleRequest,
): Promise<VehicleDetail> {
  const current = await loadVehicle(actor, id);

  if (input.branchId && input.branchId !== current.branchId) {
    await assertBranchInOrg(actor.organizationId, input.branchId);
  }

  if (input.plateNumber && input.plateNumber !== current.plateNumber) {
    const clash = await prisma.vehicle.findFirst({
      where: {
        organizationId: actor.organizationId,
        plateNumber: input.plateNumber,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (clash) throw conflict('A vehicle with this plate number already exists');
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(input.plateNumber !== undefined ? { plateNumber: input.plateNumber } : {}),
      ...(input.vin !== undefined ? { vin: input.vin } : {}),
      ...(input.make !== undefined ? { make: input.make } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.transmission !== undefined ? { transmission: input.transmission } : {}),
      ...(input.fuelType !== undefined ? { fuelType: input.fuelType } : {}),
      ...(input.seats !== undefined ? { seats: input.seats } : {}),
      ...(input.colour !== undefined ? { colour: input.colour } : {}),
      ...(input.acquisitionCost !== undefined
        ? { acquisitionCost: new Prisma.Decimal(input.acquisitionCost) }
        : {}),
      ...(input.acquisitionDate !== undefined
        ? { acquisitionDate: new Date(input.acquisitionDate) }
        : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    },
    include: { branch: true },
  });

  return toDetail(updated);
}

/**
 * Update the odometer. It is monotonic: a reading below the stored value is
 * rejected with ODOMETER_REGRESSION unless a MANAGER/OWNER overrides, and the
 * override is audit-logged (§5.2, §10).
 */
export async function updateOdometer(
  actor: AuthContext,
  id: string,
  input: OdometerUpdateRequest,
): Promise<VehicleDetail> {
  const current = await loadVehicle(actor, id);
  const isRegression = input.odometer < current.odometer;
  const isManager = actor.role === 'OWNER' || actor.role === 'MANAGER';

  if (isRegression && !isManager) {
    throw new AppError('ODOMETER_REGRESSION', 'Odometer cannot go below the current reading');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.vehicle.update({
      where: { id },
      data: { odometer: input.odometer },
      include: { branch: true },
    });
    if (isRegression) {
      await writeAudit(
        {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: 'ODOMETER_OVERRIDE',
          entityType: 'Vehicle',
          entityId: id,
          before: { odometer: current.odometer },
          after: { odometer: input.odometer, reason: input.reason ?? null },
        },
        tx,
      );
    }
    return u;
  });

  return toDetail(updated);
}

export async function setOutOfService(
  actor: AuthContext,
  id: string,
  input: OutOfServiceRequest,
): Promise<VehicleDetail> {
  await loadVehicle(actor, id);
  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      isOutOfService: input.isOutOfService,
      outOfServiceReason: input.isOutOfService ? (input.reason ?? null) : null,
    },
    include: { branch: true },
  });
  return toDetail(updated);
}

export async function softDeleteVehicle(actor: AuthContext, id: string): Promise<void> {
  await loadVehicle(actor, id);
  await prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });
}

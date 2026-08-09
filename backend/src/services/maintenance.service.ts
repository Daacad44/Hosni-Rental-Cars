import { Prisma } from '@prisma/client';
import type {
  CreateMaintenanceRequest,
  UpdateMaintenanceStatusRequest,
  MaintenanceFilters,
  MaintenanceView,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound, conflict } from '../lib/AppError.js';
import type { AuthContext } from '../middleware/authenticate.js';

type Row = Prisma.MaintenanceGetPayload<object>;

function canManageCost(actor: AuthContext): boolean {
  // MECHANIC handles maintenance but never money — cost is manager territory.
  return actor.role === 'OWNER' || actor.role === 'MANAGER';
}

async function loadVehicle(actor: AuthContext, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, plateNumber: true, branchId: true, odometer: true },
  });
  if (!vehicle) throw notFound('Vehicle not found');
  return vehicle;
}

function toView(row: Row, plate: string): MaintenanceView {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehiclePlate: plate,
    type: row.type,
    status: row.status,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd: row.scheduledEnd.toISOString(),
    odometer: row.odometer,
    vendor: row.vendor,
    cost: row.cost ? row.cost.toFixed(2) : null,
    notes: row.notes,
    nextDueAt: row.nextDueAt ? row.nextDueAt.toISOString() : null,
    nextDueOdometer: row.nextDueOdometer,
  };
}

export async function createMaintenance(
  actor: AuthContext,
  input: CreateMaintenanceRequest,
): Promise<MaintenanceView> {
  const vehicle = await loadVehicle(actor, input.vehicleId);
  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);

  // Scheduling over an existing reservation warns and needs explicit confirmation.
  if (!input.force) {
    const clash = await prisma.reservation.findFirst({
      where: {
        organizationId: actor.organizationId,
        vehicleId: vehicle.id,
        status: { in: ['CONFIRMED', 'CONVERTED'] },
        startAt: { lt: end },
        endAt: { gt: start },
      },
      select: { id: true },
    });
    if (clash) throw conflict('This overlaps a reservation — confirm to schedule anyway');
  }

  const row = await prisma.maintenance.create({
    data: {
      organizationId: actor.organizationId,
      vehicleId: vehicle.id,
      type: input.type,
      scheduledStart: start,
      scheduledEnd: end,
      odometer: input.odometer ?? null,
      vendor: input.vendor ?? null,
      cost: input.cost && canManageCost(actor) ? new Prisma.Decimal(input.cost) : null,
      notes: input.notes ?? null,
    },
  });
  return toView(row, vehicle.plateNumber);
}

async function loadMaintenance(actor: AuthContext, id: string): Promise<Row> {
  const row = await prisma.maintenance.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!row) throw notFound('Maintenance record not found');
  return row;
}

/** Complete a record: compute next-due from the org interval, free the vehicle. */
export async function updateStatus(
  actor: AuthContext,
  id: string,
  input: UpdateMaintenanceStatusRequest,
): Promise<MaintenanceView> {
  const row = await loadMaintenance(actor, id);
  const data: Prisma.MaintenanceUpdateInput = { status: input.status };
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.odometer !== undefined) data.odometer = input.odometer;
  if (input.cost !== undefined && canManageCost(actor)) data.cost = new Prisma.Decimal(input.cost);

  if (input.status === 'COMPLETED') {
    const org = await prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { serviceIntervalKm: true, serviceIntervalDays: true },
    });
    const baseOdo = input.odometer ?? row.odometer;
    data.completedAt = new Date();
    data.nextDueAt = new Date(Date.now() + (org?.serviceIntervalDays ?? 180) * 86400000);
    if (baseOdo != null) data.nextDueOdometer = baseOdo + (org?.serviceIntervalKm ?? 5000);
  }

  const updated = await prisma.maintenance.update({ where: { id }, data });
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: row.vehicleId },
    select: { plateNumber: true },
  });
  return toView(updated, vehicle?.plateNumber ?? '—');
}

export async function listMaintenance(
  actor: AuthContext,
  filters: MaintenanceFilters,
): Promise<{ rows: MaintenanceView[]; total: number }> {
  const where: Prisma.MaintenanceWhereInput = {
    organizationId: actor.organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.maintenance.findMany({
      where,
      orderBy: { scheduledStart: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.maintenance.count({ where }),
  ]);
  const plates = new Map(
    (
      await prisma.vehicle.findMany({
        where: { id: { in: rows.map((r) => r.vehicleId) } },
        select: { id: true, plateNumber: true },
      })
    ).map((v) => [v.id, v.plateNumber]),
  );
  return { rows: rows.map((r) => toView(r, plates.get(r.vehicleId) ?? '—')), total };
}

export async function getMaintenance(actor: AuthContext, id: string): Promise<MaintenanceView> {
  const row = await loadMaintenance(actor, id);
  const vehicle = await prisma.vehicle.findUnique({ where: { id: row.vehicleId }, select: { plateNumber: true } });
  return toView(row, vehicle?.plateNumber ?? '—');
}

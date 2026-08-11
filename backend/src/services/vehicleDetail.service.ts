import { Prisma } from '@prisma/client';
import type {
  VehicleAvailability,
  VehicleAvailabilityEntry,
  VehicleRentalRow,
  VehicleMaintenanceRow,
  VehicleDamageRow,
  VehicleExpenseRow,
  VehicleProfitability,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import { deriveVehicleStatus } from './vehicleStatus.service.js';
import { resolveStatusInputs } from './vehicleStatusResolver.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

/**
 * Data behind the vehicle detail tabs (§5.2). Every function first re-scopes the
 * vehicle to the caller's organization (and branch, for an AGENT) so a tab can
 * never read across the tenant boundary — the vehicle id in the URL is never
 * trusted on its own.
 */
async function scopeVehicle(
  actor: AuthContext,
  vehicleId: string,
): Promise<{ id: string; branchId: string; isOutOfService: boolean }> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, branchId: true, isOutOfService: true },
  });
  if (!vehicle) throw notFound('Vehicle not found');
  if (actor.role === 'AGENT' && vehicle.branchId !== actor.branchId) throw notFound('Vehicle not found');
  return vehicle;
}

export async function getAvailability(actor: AuthContext, vehicleId: string): Promise<VehicleAvailability> {
  const vehicle = await scopeVehicle(actor, vehicleId);
  const now = new Date();

  const [inputs, reservations, agreements, maintenance] = await Promise.all([
    resolveStatusInputs(actor.organizationId, [vehicle.id], now),
    prisma.reservation.findMany({
      where: { organizationId: actor.organizationId, vehicleId: vehicle.id, status: { in: ['CONFIRMED', 'CONVERTED'] }, endAt: { gt: now } },
      orderBy: { startAt: 'asc' },
      select: { id: true, startAt: true, endAt: true, status: true, category: true },
      take: 50,
    }),
    prisma.agreement.findMany({
      where: { organizationId: actor.organizationId, vehicleId: vehicle.id, status: { in: ['OPEN', 'OVERDUE'] } },
      orderBy: { startAt: 'asc' },
      select: { id: true, startAt: true, endAt: true, status: true, agreementNumber: true },
      take: 50,
    }),
    prisma.maintenance.findMany({
      where: { organizationId: actor.organizationId, vehicleId: vehicle.id, status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledEnd: { gt: now } },
      orderBy: { scheduledStart: 'asc' },
      select: { id: true, scheduledStart: true, scheduledEnd: true, status: true, type: true },
      take: 50,
    }),
  ]);

  const entries: VehicleAvailabilityEntry[] = [
    ...agreements.map((a) => ({
      kind: 'AGREEMENT' as const,
      id: a.id,
      label: `#${a.agreementNumber}`,
      status: a.status,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
    })),
    ...reservations.map((r) => ({
      kind: 'RESERVATION' as const,
      id: r.id,
      label: r.category,
      status: r.status,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
    })),
    ...maintenance.map((m) => ({
      kind: 'MAINTENANCE' as const,
      id: m.id,
      label: m.type,
      status: m.status,
      startAt: m.scheduledStart.toISOString(),
      endAt: m.scheduledEnd.toISOString(),
    })),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));

  return {
    status: deriveVehicleStatus({ isOutOfService: vehicle.isOutOfService, ...(inputs.get(vehicle.id) ?? {}) }),
    entries,
  };
}

export async function listRentals(actor: AuthContext, vehicleId: string): Promise<VehicleRentalRow[]> {
  const vehicle = await scopeVehicle(actor, vehicleId);
  const rows = await prisma.agreement.findMany({
    where: { organizationId: actor.organizationId, vehicleId: vehicle.id },
    orderBy: { startAt: 'desc' },
    take: 100,
  });
  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const customers = new Map(
    (await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, fullName: true } })).map((c) => [c.id, c.fullName]),
  );
  return rows.map((r) => ({
    id: r.id,
    agreementNumber: r.agreementNumber,
    customerName: customers.get(r.customerId) ?? '—',
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    status: r.status,
  }));
}

export async function listMaintenance(actor: AuthContext, vehicleId: string): Promise<VehicleMaintenanceRow[]> {
  const vehicle = await scopeVehicle(actor, vehicleId);
  const rows = await prisma.maintenance.findMany({
    where: { organizationId: actor.organizationId, vehicleId: vehicle.id },
    orderBy: { scheduledStart: 'desc' },
    take: 100,
  });
  return rows.map((m) => ({
    id: m.id,
    type: m.type,
    status: m.status,
    scheduledStart: m.scheduledStart.toISOString(),
    scheduledEnd: m.scheduledEnd.toISOString(),
    vendor: m.vendor,
    cost: m.cost ? m.cost.toFixed(2) : null,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
  }));
}

export async function listDamages(actor: AuthContext, vehicleId: string): Promise<VehicleDamageRow[]> {
  const vehicle = await scopeVehicle(actor, vehicleId);
  const rows = await prisma.damage.findMany({
    where: { organizationId: actor.organizationId, vehicleId: vehicle.id },
    orderBy: [{ repairedAt: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  const agreementIds = [...new Set(rows.map((d) => d.agreementId).filter((v): v is string => v !== null))];
  const numbers = new Map(
    (await prisma.agreement.findMany({ where: { id: { in: agreementIds } }, select: { id: true, agreementNumber: true } })).map((a) => [a.id, a.agreementNumber]),
  );
  return rows.map((d) => ({
    id: d.id,
    panel: d.panel,
    severity: d.severity,
    notes: d.notes,
    chargeable: d.chargeable,
    chargeAmount: d.chargeAmount ? d.chargeAmount.toFixed(2) : null,
    repairedAt: d.repairedAt ? d.repairedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    agreementId: d.agreementId,
    agreementNumber: d.agreementId ? (numbers.get(d.agreementId) ?? null) : null,
  }));
}

/**
 * Mark a damage repaired (§5.7). Once repaired it stops being carried forward as
 * pre-existing damage on the vehicle. Audit-logged; a repaired damage cannot be
 * "un-repaired" here — a fresh inspection records any new damage.
 */
export async function markDamageRepaired(
  actor: AuthContext,
  vehicleId: string,
  damageId: string,
): Promise<VehicleDamageRow> {
  const vehicle = await scopeVehicle(actor, vehicleId);
  const damage = await prisma.damage.findFirst({
    where: { id: damageId, organizationId: actor.organizationId, vehicleId: vehicle.id },
  });
  if (!damage) throw notFound('Damage not found');

  if (damage.repairedAt === null) {
    await prisma.$transaction(async (tx) => {
      await tx.damage.update({ where: { id: damage.id }, data: { repairedAt: new Date() } });
      await writeAudit(
        {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: 'DAMAGE_REPAIRED',
          entityType: 'Damage',
          entityId: damage.id,
          before: { repairedAt: null },
          after: { repairedAt: new Date().toISOString(), panel: damage.panel },
        },
        tx,
      );
    });
  }

  const [updated] = await listDamages(actor, vehicleId).then((all) => all.filter((d) => d.id === damageId));
  if (!updated) throw notFound('Damage not found');
  return updated;
}

export async function listExpenses(actor: AuthContext, vehicleId: string): Promise<VehicleExpenseRow[]> {
  const vehicle = await scopeVehicle(actor, vehicleId);
  const rows = await prisma.expense.findMany({
    where: { organizationId: actor.organizationId, vehicleId: vehicle.id },
    orderBy: { date: 'desc' },
    take: 200,
  });
  return rows.map((e) => ({
    id: e.id,
    category: e.category,
    amount: e.amount.toFixed(2),
    date: e.date.toISOString(),
    description: e.description,
  }));
}

export async function getProfitability(actor: AuthContext, vehicleId: string): Promise<VehicleProfitability> {
  const vehicle = await scopeVehicle(actor, vehicleId);
  const [revenueAgg, expenseAgg, maintenanceAgg] = await Promise.all([
    prisma.invoiceLine.aggregate({
      _sum: { amount: true },
      where: {
        organizationId: actor.organizationId,
        kind: { notIn: ['DEPOSIT', 'DEPOSIT_REFUND'] },
        invoice: { is: { isVoid: false, agreement: { is: { vehicleId: vehicle.id } } } },
      },
    }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { organizationId: actor.organizationId, vehicleId: vehicle.id } }),
    prisma.maintenance.aggregate({ _sum: { cost: true }, where: { organizationId: actor.organizationId, vehicleId: vehicle.id } }),
  ]);
  const revenue = revenueAgg._sum.amount ?? new Prisma.Decimal(0);
  const expenses = expenseAgg._sum.amount ?? new Prisma.Decimal(0);
  const maintenance = maintenanceAgg._sum.cost ?? new Prisma.Decimal(0);
  return {
    revenue: revenue.toFixed(2),
    expenses: expenses.toFixed(2),
    maintenance: maintenance.toFixed(2),
    profit: revenue.minus(expenses).minus(maintenance).toFixed(2),
  };
}

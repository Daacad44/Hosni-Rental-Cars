import { Prisma } from '@prisma/client';
import type {
  Dashboard,
  RevenueReport,
  ProfitabilityRow,
  OutstandingRow,
  OverdueRow,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import type { AuthContext } from '../middleware/authenticate.js';

// Deposits are never revenue; voided invoices are excluded everywhere.
const REVENUE_EXCLUDED = ['DEPOSIT', 'DEPOSIT_REFUND'];

function money(d: Prisma.Decimal | null | undefined): string {
  return (d ?? new Prisma.Decimal(0)).toFixed(2);
}

export async function dashboard(actor: AuthContext): Promise<Dashboard> {
  const orgId = actor.organizationId;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalVehicles,
    outOfService,
    rentedVehicles,
    maintenanceVehicles,
    overdue,
    todayPickups,
    todayReturns,
    revenueAgg,
    outstandingAgg,
    pickups,
    returns,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.vehicle.count({ where: { organizationId: orgId, deletedAt: null, isOutOfService: true } }),
    prisma.agreement.findMany({ where: { organizationId: orgId, status: { in: ['OPEN', 'OVERDUE'] } }, select: { vehicleId: true }, distinct: ['vehicleId'] }),
    prisma.maintenance.findMany({ where: { organizationId: orgId, status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledStart: { lte: now }, scheduledEnd: { gt: now } }, select: { vehicleId: true }, distinct: ['vehicleId'] }),
    prisma.agreement.count({ where: { organizationId: orgId, status: 'OVERDUE' } }),
    prisma.reservation.count({ where: { organizationId: orgId, status: 'CONFIRMED', startAt: { gte: startOfDay, lt: endOfDay } } }),
    prisma.agreement.count({ where: { organizationId: orgId, status: { in: ['OPEN', 'OVERDUE'] }, endAt: { gte: startOfDay, lt: endOfDay } } }),
    prisma.invoiceLine.aggregate({
      _sum: { amount: true },
      where: { organizationId: orgId, kind: { notIn: REVENUE_EXCLUDED }, createdAt: { gte: startOfMonth }, invoice: { is: { isVoid: false } } },
    }),
    prisma.invoice.aggregate({ _sum: { balance: true }, where: { organizationId: orgId, isVoid: false, balance: { gt: 0 } } }),
    prisma.reservation.findMany({ where: { organizationId: orgId, status: 'CONFIRMED', startAt: { gte: startOfDay, lt: endOfDay } }, select: { id: true, startAt: true, category: true }, take: 20 }),
    prisma.agreement.findMany({ where: { organizationId: orgId, status: { in: ['OPEN', 'OVERDUE'] }, endAt: { gte: startOfDay, lt: endOfDay } }, select: { id: true, endAt: true, agreementNumber: true }, take: 20 }),
  ]);

  const rentedCount = rentedVehicles.length;
  const maintCount = maintenanceVehicles.length;
  const available = Math.max(0, totalVehicles - outOfService - rentedCount - maintCount);

  return {
    kpis: {
      vehiclesOut: rentedCount,
      available,
      inMaintenance: maintCount,
      overdue,
      todayPickups,
      todayReturns,
      revenueMtd: money(revenueAgg._sum.amount),
      outstanding: money(outstandingAgg._sum.balance),
    },
    todaySchedule: [
      ...pickups.map((p) => ({ kind: 'PICKUP' as const, id: p.id, label: p.category, at: p.startAt.toISOString() })),
      ...returns.map((r) => ({ kind: 'RETURN' as const, id: r.id, label: `#${r.agreementNumber}`, at: r.endAt.toISOString() })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
  };
}

/** Revenue by day over a range. Aggregation happens in SQL, never in Node. */
export async function revenueReport(actor: AuthContext, from: Date, to: Date): Promise<RevenueReport> {
  const rows = await prisma.$queryRaw<Array<{ period: Date; revenue: Prisma.Decimal }>>(Prisma.sql`
    SELECT date_trunc('day', il."createdAt") AS period, COALESCE(SUM(il."amount"), 0) AS revenue
    FROM "InvoiceLine" il
    JOIN "Invoice" i ON i."id" = il."invoiceId"
    WHERE il."organizationId" = ${actor.organizationId}
      AND i."isVoid" = false
      AND il."kind" NOT IN ('DEPOSIT', 'DEPOSIT_REFUND')
      AND il."createdAt" >= ${from} AND il."createdAt" < ${to}
    GROUP BY 1
    ORDER BY 1
  `);
  const points = rows.map((r) => ({ period: r.period.toISOString().slice(0, 10), revenue: money(r.revenue) }));
  const total = points.reduce((sum, p) => sum.plus(new Prisma.Decimal(p.revenue)), new Prisma.Decimal(0));
  return { total: total.toFixed(2), points };
}

/** Per-vehicle revenue minus expenses and maintenance cost. */
export async function profitabilityReport(actor: AuthContext): Promise<ProfitabilityRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ vehicleId: string; plateNumber: string; revenue: Prisma.Decimal; expenses: Prisma.Decimal; maintenance: Prisma.Decimal }>
  >(Prisma.sql`
    SELECT v."id" AS "vehicleId", v."plateNumber",
      COALESCE((
        SELECT SUM(il."amount") FROM "InvoiceLine" il
        JOIN "Invoice" i ON i."id" = il."invoiceId"
        JOIN "Agreement" a ON a."id" = i."agreementId"
        WHERE a."vehicleId" = v."id" AND i."isVoid" = false AND il."kind" NOT IN ('DEPOSIT','DEPOSIT_REFUND')
      ), 0) AS revenue,
      COALESCE((SELECT SUM(e."amount") FROM "Expense" e WHERE e."vehicleId" = v."id"), 0) AS expenses,
      COALESCE((SELECT SUM(m."cost") FROM "Maintenance" m WHERE m."vehicleId" = v."id"), 0) AS maintenance
    FROM "Vehicle" v
    WHERE v."organizationId" = ${actor.organizationId} AND v."deletedAt" IS NULL
    ORDER BY revenue DESC
  `);
  return rows.map((r) => {
    const profit = new Prisma.Decimal(r.revenue).minus(r.expenses).minus(r.maintenance);
    return {
      vehicleId: r.vehicleId,
      plateNumber: r.plateNumber,
      revenue: money(r.revenue),
      expenses: money(r.expenses),
      maintenance: money(r.maintenance),
      profit: profit.toFixed(2),
    };
  });
}

export async function outstandingReport(actor: AuthContext): Promise<OutstandingRow[]> {
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: actor.organizationId, isVoid: false, balance: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  });
  const customerIds = [...new Set(invoices.map((i) => i.customerId))];
  const customers = new Map(
    (await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, fullName: true } })).map((c) => [c.id, c.fullName]),
  );
  const now = Date.now();
  return invoices.map((i) => {
    const ageDays = Math.floor((now - i.createdAt.getTime()) / 86400000);
    const bucket = ageDays <= 30 ? '0-30' : ageDays <= 60 ? '31-60' : ageDays <= 90 ? '61-90' : '90+';
    return {
      invoiceId: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: customers.get(i.customerId) ?? '—',
      balance: money(i.balance),
      ageDays,
      bucket,
    };
  });
}

export async function overdueReport(actor: AuthContext): Promise<OverdueRow[]> {
  const agreements = await prisma.agreement.findMany({
    where: { organizationId: actor.organizationId, status: 'OVERDUE' },
    orderBy: { endAt: 'asc' },
  });
  const customerIds = [...new Set(agreements.map((a) => a.customerId))];
  const vehicleIds = [...new Set(agreements.map((a) => a.vehicleId))];
  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, fullName: true } }),
    prisma.vehicle.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, plateNumber: true } }),
  ]);
  const cName = new Map(customers.map((c) => [c.id, c.fullName]));
  const vPlate = new Map(vehicles.map((v) => [v.id, v.plateNumber]));
  const now = Date.now();
  return agreements.map((a) => ({
    agreementId: a.id,
    agreementNumber: a.agreementNumber,
    customerName: cName.get(a.customerId) ?? '—',
    vehiclePlate: vPlate.get(a.vehicleId) ?? '—',
    dueAt: a.endAt.toISOString(),
    overdueDays: Math.floor((now - a.endAt.getTime()) / 86400000),
  }));
}

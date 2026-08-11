import { Prisma } from '@prisma/client';
import type {
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFilters,
  CustomerListItem,
  CustomerDetail,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound, conflict } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

type CustomerRow = Prisma.CustomerGetPayload<object>;

function licenceExpired(licenceExpiry: Date | null): boolean {
  return licenceExpiry !== null && licenceExpiry.getTime() < Date.now();
}

function emptyOrValue(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  return v === '' ? null : v;
}

async function loadCustomer(actor: AuthContext, id: string): Promise<CustomerRow> {
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!customer) throw notFound('Customer not found');
  return customer;
}

/**
 * Guard reused by the reservation and agreement modules: a blocked customer can
 * never be attached to a new booking, and a licence that expires before the
 * planned return is rejected (a manager may override the latter upstream).
 */
export function assertBookable(customer: CustomerRow, plannedReturn: Date): void {
  if (customer.isBlocked) throw new AppError('CUSTOMER_BLOCKED', 'This customer is blocked');
  if (customer.licenceExpiry && customer.licenceExpiry.getTime() < plannedReturn.getTime()) {
    throw new AppError('LICENCE_EXPIRED', 'The licence expires before the planned return date');
  }
}

export async function listCustomers(
  actor: AuthContext,
  filters: CustomerFilters,
): Promise<{ rows: CustomerListItem[]; total: number }> {
  const where: Prisma.CustomerWhereInput = {
    organizationId: actor.organizationId,
    deletedAt: null,
    ...(filters.blocked !== undefined ? { isBlocked: filters.blocked } : {}),
    ...(filters.q
      ? {
          OR: [
            { fullName: { contains: filters.q, mode: 'insensitive' } },
            { phone: { contains: filters.q, mode: 'insensitive' } },
            { nationalId: { contains: filters.q, mode: 'insensitive' } },
            { licenceNumber: { contains: filters.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { fullName: 'asc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    rows: rows.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      licenceNumber: c.licenceNumber,
      isBlocked: c.isBlocked,
      licenceExpired: licenceExpired(c.licenceExpiry),
    })),
    total,
  };
}

const REVENUE_EXCLUDED = ['DEPOSIT', 'DEPOSIT_REFUND'];

/**
 * Lifetime figures for a customer, aggregated in SQL. Total spend is revenue
 * lines paid (deposits excluded); outstanding is unpaid invoice balance; a late
 * return is one closed after its due time or still overdue.
 */
async function customerStats(organizationId: string, customerId: string) {
  const [rentalCount, agreements, spendAgg, outstandingAgg] = await Promise.all([
    prisma.agreement.count({ where: { organizationId, customerId } }),
    prisma.agreement.findMany({
      where: { organizationId, customerId },
      select: { id: true, status: true, endAt: true, closedAt: true },
    }),
    prisma.invoiceLine.aggregate({
      _sum: { amount: true },
      where: {
        organizationId,
        kind: { notIn: REVENUE_EXCLUDED },
        invoice: { is: { customerId, isVoid: false } },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { balance: true },
      where: { organizationId, customerId, isVoid: false, balance: { gt: 0 } },
    }),
  ]);

  const agreementIds = agreements.map((a) => a.id);
  const damageCount = agreementIds.length
    ? await prisma.damage.count({ where: { organizationId, agreementId: { in: agreementIds } } })
    : 0;

  const lateReturnCount = agreements.filter(
    (a) => a.status === 'OVERDUE' || (a.closedAt !== null && a.closedAt.getTime() > a.endAt.getTime()),
  ).length;

  return {
    rentalCount,
    totalSpend: (spendAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    outstandingBalance: (outstandingAgg._sum.balance ?? new Prisma.Decimal(0)).toFixed(2),
    damageCount,
    lateReturnCount,
  };
}

export async function getCustomer(actor: AuthContext, id: string): Promise<CustomerDetail> {
  const c = await loadCustomer(actor, id);
  const stats = await customerStats(actor.organizationId, id);
  return {
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    email: c.email,
    nationalId: c.nationalId,
    licenceNumber: c.licenceNumber,
    licenceExpiry: c.licenceExpiry ? c.licenceExpiry.toISOString() : null,
    address: c.address,
    notes: c.notes,
    isBlocked: c.isBlocked,
    blockReason: c.blockReason,
    licenceExpired: licenceExpired(c.licenceExpiry),
    stats,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function createCustomer(
  actor: AuthContext,
  input: CreateCustomerRequest,
): Promise<CustomerDetail> {
  const clash = await prisma.customer.findFirst({
    where: { organizationId: actor.organizationId, phone: input.phone, deletedAt: null },
  });
  if (clash) throw conflict('A customer with this phone number already exists');

  const customer = await prisma.customer.create({
    data: {
      organizationId: actor.organizationId,
      fullName: input.fullName,
      phone: input.phone,
      email: emptyOrValue(input.email) ?? null,
      nationalId: input.nationalId ?? null,
      licenceNumber: input.licenceNumber ?? null,
      licenceExpiry: input.licenceExpiry ? new Date(input.licenceExpiry) : null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    },
  });
  return getCustomer(actor, customer.id);
}

export async function updateCustomer(
  actor: AuthContext,
  id: string,
  input: UpdateCustomerRequest,
): Promise<CustomerDetail> {
  const current = await loadCustomer(actor, id);

  if (input.phone && input.phone !== current.phone) {
    const clash = await prisma.customer.findFirst({
      where: {
        organizationId: actor.organizationId,
        phone: input.phone,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (clash) throw conflict('A customer with this phone number already exists');
  }

  await prisma.customer.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: emptyOrValue(input.email) } : {}),
      ...(input.nationalId !== undefined ? { nationalId: input.nationalId } : {}),
      ...(input.licenceNumber !== undefined ? { licenceNumber: input.licenceNumber } : {}),
      ...(input.licenceExpiry !== undefined
        ? { licenceExpiry: input.licenceExpiry ? new Date(input.licenceExpiry) : null }
        : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
  return getCustomer(actor, id);
}

export async function setBlocked(
  actor: AuthContext,
  id: string,
  blocked: boolean,
  reason?: string,
): Promise<CustomerDetail> {
  const current = await loadCustomer(actor, id);
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id },
      data: {
        isBlocked: blocked,
        blockReason: blocked ? (reason ?? null) : null,
        blockedAt: blocked ? new Date() : null,
        blockedById: blocked ? actor.id : null,
      },
    });
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: blocked ? 'CUSTOMER_BLOCKED' : 'CUSTOMER_UNBLOCKED',
        entityType: 'Customer',
        entityId: id,
        before: { isBlocked: current.isBlocked },
        after: { isBlocked: blocked, reason: reason ?? null },
      },
      tx,
    );
  });
  return getCustomer(actor, id);
}

/** Merge a duplicate into a surviving customer. Manager only, audit-logged. */
export async function mergeCustomers(
  actor: AuthContext,
  winnerId: string,
  loserId: string,
): Promise<CustomerDetail> {
  if (winnerId === loserId) throw conflict('Cannot merge a customer into itself');
  const winner = await loadCustomer(actor, winnerId);
  const loser = await loadCustomer(actor, loserId);

  await prisma.$transaction(async (tx) => {
    // Later modules repoint agreements, reservations and invoices from loser to
    // winner here before the loser is retired.
    await tx.customer.update({
      where: { id: loser.id },
      data: { deletedAt: new Date(), mergedIntoId: winner.id },
    });
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'CUSTOMER_MERGED',
        entityType: 'Customer',
        entityId: winner.id,
        before: { loserId: loser.id, loserName: loser.fullName },
        after: { winnerId: winner.id },
      },
      tx,
    );
  });
  return getCustomer(actor, winnerId);
}

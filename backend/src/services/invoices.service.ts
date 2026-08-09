import { Prisma } from '@prisma/client';
import type {
  InvoiceView,
  InvoiceStatus,
  RecordPaymentRequest,
  CashSummary,
  InvoiceFilters,
  InvoiceListItem,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound, conflict } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import { nextValue } from './counter.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

type Db = Prisma.TransactionClient;

export interface NewLine {
  kind: string;
  description: string;
  quantity: number;
  unitAmount: string;
  amount: string;
}

/** Status is derived from the balance — never typed. */
export function deriveInvoiceStatus(inv: {
  isVoid: boolean;
  total: Prisma.Decimal;
  paid: Prisma.Decimal;
}): InvoiceStatus {
  if (inv.isVoid) return 'VOID';
  if (inv.total.isZero()) return 'DRAFT';
  if (inv.paid.isZero()) return 'ISSUED';
  if (inv.paid.lessThan(inv.total)) return 'PARTIAL';
  return 'PAID';
}

export async function createInvoice(
  tx: Db,
  params: { organizationId: string; branchId: string; agreementId?: string; customerId: string; createdById?: string },
): Promise<string> {
  const invoiceNumber = await nextValue(tx, params.organizationId, 'invoice');
  const invoice = await tx.invoice.create({
    data: {
      organizationId: params.organizationId,
      branchId: params.branchId,
      invoiceNumber,
      agreementId: params.agreementId ?? null,
      customerId: params.customerId,
      createdById: params.createdById ?? null,
    },
  });
  return invoice.id;
}

/** Add lines and recompute totals in the same transaction. */
export async function addLines(tx: Db, organizationId: string, invoiceId: string, lines: NewLine[]): Promise<void> {
  if (lines.length === 0) return;
  await tx.invoiceLine.createMany({
    data: lines.map((l) => ({
      organizationId,
      invoiceId,
      kind: l.kind,
      description: l.description,
      quantity: l.quantity,
      unitAmount: new Prisma.Decimal(l.unitAmount),
      amount: new Prisma.Decimal(l.amount),
    })),
  });
  await recompute(tx, invoiceId);
}

/** balance = total(lines) - paid(payments), recomputed atomically. */
export async function recompute(tx: Db, invoiceId: string): Promise<void> {
  const [lineAgg, payAgg] = await Promise.all([
    tx.invoiceLine.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
    tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
  ]);
  const total = lineAgg._sum.amount ?? new Prisma.Decimal(0);
  const paid = payAgg._sum.amount ?? new Prisma.Decimal(0);
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { total, paid, balance: total.minus(paid) },
  });
}

/** Record a payment against an invoice inside a transaction. */
export async function recordPaymentTx(
  tx: Db,
  params: {
    organizationId: string;
    invoiceId: string;
    amount: string;
    method: RecordPaymentRequest['method'];
    reference?: string;
    receivedById?: string;
    idempotencyKey?: string;
  },
): Promise<void> {
  await tx.payment.create({
    data: {
      organizationId: params.organizationId,
      invoiceId: params.invoiceId,
      amount: new Prisma.Decimal(params.amount),
      method: params.method,
      reference: params.reference ?? null,
      receivedById: params.receivedById ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
    },
  });
  await recompute(tx, params.invoiceId);
}

async function loadInvoice(actor: AuthContext, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { lines: { orderBy: { createdAt: 'asc' } }, payments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!invoice) throw notFound('Invoice not found');
  if (actor.role === 'AGENT' && invoice.branchId !== actor.branchId) throw notFound('Invoice not found');
  return invoice;
}

type InvoiceWith = Prisma.InvoiceGetPayload<{ include: { lines: true; payments: true } }>;

function toView(inv: InvoiceWith): InvoiceView {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    agreementId: inv.agreementId,
    customerId: inv.customerId,
    status: deriveInvoiceStatus(inv),
    total: inv.total.toFixed(2),
    paid: inv.paid.toFixed(2),
    balance: inv.balance.toFixed(2),
    voidReason: inv.voidReason,
    createdAt: inv.createdAt.toISOString(),
    lines: inv.lines.map((l) => ({
      id: l.id,
      kind: l.kind as InvoiceView['lines'][number]['kind'],
      description: l.description,
      quantity: l.quantity,
      unitAmount: l.unitAmount.toFixed(2),
      amount: l.amount.toFixed(2),
    })),
    payments: inv.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toFixed(2),
      method: p.method,
      reference: p.reference,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export async function getInvoice(actor: AuthContext, id: string): Promise<InvoiceView> {
  return toView(await loadInvoice(actor, id));
}

/**
 * Record a payment. Idempotent on Idempotency-Key: a double-submitted payment
 * returns the existing invoice unchanged rather than charging twice.
 */
export async function recordPayment(
  actor: AuthContext,
  invoiceId: string,
  input: RecordPaymentRequest,
  idempotencyKey?: string,
): Promise<InvoiceView> {
  const invoice = await loadInvoice(actor, invoiceId);
  if (invoice.isVoid) throw conflict('Cannot pay a voided invoice');

  if (idempotencyKey) {
    const existing = await prisma.payment.findUnique({
      where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey } },
    });
    if (existing) return toView(await loadInvoice(actor, invoiceId));
  }

  try {
    await prisma.$transaction((tx) =>
      recordPaymentTx(tx, {
        organizationId: actor.organizationId,
        invoiceId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        receivedById: actor.id,
        idempotencyKey,
      }),
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Concurrent duplicate with the same idempotency key: treat as success.
      return toView(await loadInvoice(actor, invoiceId));
    }
    throw err;
  }

  return toView(await loadInvoice(actor, invoiceId));
}

/** Void an invoice. Manager only, reason required; the record stays visible. */
export async function voidInvoice(actor: AuthContext, id: string, reason: string): Promise<InvoiceView> {
  const invoice = await loadInvoice(actor, id);
  if (invoice.isVoid) throw conflict('Invoice is already void');
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: { isVoid: true, voidReason: reason, voidedById: actor.id, voidedAt: new Date() },
    });
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'INVOICE_VOIDED',
        entityType: 'Invoice',
        entityId: id,
        before: { total: invoice.total.toFixed(2), balance: invoice.balance.toFixed(2) },
        after: { reason },
      },
      tx,
    );
  });
  return toView(await loadInvoice(actor, id));
}

export async function listInvoices(
  actor: AuthContext,
  filters: InvoiceFilters,
): Promise<{ rows: InvoiceListItem[]; total: number }> {
  const scopedBranch = actor.role === 'AGENT' ? (actor.branchId ?? '__none__') : filters.branchId;
  const where: Prisma.InvoiceWhereInput = {
    organizationId: actor.organizationId,
    ...(scopedBranch ? { branchId: scopedBranch } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { lines: true, payments: true },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  const filtered = filters.status ? rows.filter((r) => deriveInvoiceStatus(r) === filters.status) : rows;

  return {
    rows: filtered.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      customerId: r.customerId,
      status: deriveInvoiceStatus(r),
      total: r.total.toFixed(2),
      balance: r.balance.toFixed(2),
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  };
}

/** Daily cash summary by method and by user, per branch, for the cash box. */
export async function cashSummary(actor: AuthContext, date: string, branchId?: string): Promise<CashSummary> {
  const day = new Date(date);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start.getTime() + 86400000);
  const scopedBranch = actor.role === 'AGENT' ? (actor.branchId ?? '__none__') : branchId;

  const payments = await prisma.payment.findMany({
    where: {
      organizationId: actor.organizationId,
      createdAt: { gte: start, lt: end },
      ...(scopedBranch ? { invoice: { branchId: scopedBranch } } : {}),
    },
    select: { amount: true, method: true, receivedById: true },
  });

  const byMethod: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  let totalCents = 0;
  for (const p of payments) {
    const cents = Math.round(Number(p.amount) * 100);
    totalCents += cents;
    byMethod[p.method] = (byMethod[p.method] ?? 0) + cents;
    const u = p.receivedById ?? 'unknown';
    byUser[u] = (byUser[u] ?? 0) + cents;
  }
  const fmt = (c: number) => (c / 100).toFixed(2);

  return {
    date,
    total: fmt(totalCents),
    byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, fmt(v)])),
    byUser: Object.fromEntries(Object.entries(byUser).map(([k, v]) => [k, fmt(v)])),
  };
}

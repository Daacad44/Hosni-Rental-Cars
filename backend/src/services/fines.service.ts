import { Prisma } from '@prisma/client';
import type { CreateFineRequest, FineView } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound, conflict } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import { createInvoice, addLines, recompute } from './invoices.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

type Row = Prisma.TrafficFineGetPayload<object>;

/** The agreement active on a vehicle at a given moment, if any. */
async function suggestAgreement(organizationId: string, vehicleId: string, at: Date) {
  return prisma.agreement.findFirst({
    where: { organizationId, vehicleId, startAt: { lte: at }, endAt: { gte: at } },
    orderBy: { startAt: 'desc' },
    select: { id: true, customerId: true },
  });
}

async function toView(r: Row): Promise<FineView> {
  const [vehicle, suggested] = await Promise.all([
    r.vehicleId ? prisma.vehicle.findUnique({ where: { id: r.vehicleId }, select: { plateNumber: true } }) : null,
    r.vehicleId ? suggestAgreement(r.organizationId, r.vehicleId, r.offenceAt) : null,
  ]);
  const customer = suggested
    ? await prisma.customer.findUnique({ where: { id: suggested.customerId }, select: { fullName: true } })
    : null;
  return {
    id: r.id,
    noticeNumber: r.noticeNumber,
    offenceAt: r.offenceAt.toISOString(),
    location: r.location,
    amount: r.amount.toFixed(2),
    vehicleId: r.vehicleId,
    vehiclePlate: vehicle?.plateNumber ?? null,
    suggestedAgreementId: r.agreementId ?? suggested?.id ?? null,
    suggestedCustomerName: customer?.fullName ?? null,
    customerCharged: r.customerCharged,
    invoiceId: r.invoiceId,
  };
}

export async function createFine(actor: AuthContext, input: CreateFineRequest): Promise<FineView> {
  const offenceAt = new Date(input.offenceAt);
  const suggested = await suggestAgreement(actor.organizationId, input.vehicleId, offenceAt);
  const row = await prisma.trafficFine.create({
    data: {
      organizationId: actor.organizationId,
      noticeNumber: input.noticeNumber,
      offenceAt,
      location: input.location,
      amount: new Prisma.Decimal(input.amount),
      vehicleId: input.vehicleId,
      agreementId: suggested?.id ?? null,
      notes: input.notes ?? null,
      createdById: actor.id,
    },
  });
  return toView(row);
}

export async function listFines(actor: AuthContext, page: number, pageSize: number): Promise<{ rows: FineView[]; total: number }> {
  const where = { organizationId: actor.organizationId };
  const [rows, total] = await Promise.all([
    prisma.trafficFine.findMany({ where, orderBy: { offenceAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.trafficFine.count({ where }),
  ]);
  return { rows: await Promise.all(rows.map(toView)), total };
}

/**
 * Charge a fine to a customer: add a FINE line to the active agreement's open
 * invoice, or create a standalone invoice if the agreement is closed. Manager
 * only, audit-logged.
 */
export async function chargeFine(actor: AuthContext, id: string, customerId: string): Promise<FineView> {
  const fine = await prisma.trafficFine.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!fine) throw notFound('Fine not found');
  if (fine.customerCharged) throw conflict('This fine has already been charged');

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) throw notFound('Customer not found');

  const invoiceId = await prisma.$transaction(async (tx) => {
    // Prefer an open invoice on the active agreement; else create a standalone one.
    let targetInvoiceId: string | null = null;
    let branchId = actor.branchId ?? '';

    if (fine.agreementId) {
      const agreement = await tx.agreement.findFirst({
        where: { id: fine.agreementId, organizationId: actor.organizationId },
        select: { branchId: true, status: true },
      });
      if (agreement) branchId = agreement.branchId;
      if (agreement && agreement.status !== 'CLOSED') {
        const invoice = await tx.invoice.findFirst({
          where: { agreementId: fine.agreementId, organizationId: actor.organizationId, isVoid: false },
          select: { id: true },
        });
        targetInvoiceId = invoice?.id ?? null;
      }
    }

    if (!targetInvoiceId) {
      if (!branchId) {
        const anyBranch = await tx.branch.findFirst({ where: { organizationId: actor.organizationId }, select: { id: true } });
        branchId = anyBranch?.id ?? '';
      }
      targetInvoiceId = await createInvoice(tx, {
        organizationId: actor.organizationId,
        branchId,
        customerId,
        createdById: actor.id,
      });
    }

    await addLines(tx, actor.organizationId, targetInvoiceId, [
      {
        kind: 'FINE',
        description: `FINE ${fine.noticeNumber}`,
        quantity: 1,
        unitAmount: fine.amount.toFixed(2),
        amount: fine.amount.toFixed(2),
      },
    ]);
    await recompute(tx, targetInvoiceId);

    await tx.trafficFine.update({
      where: { id },
      data: { customerCharged: true, invoiceId: targetInvoiceId },
    });
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'FINE_CHARGED',
        entityType: 'TrafficFine',
        entityId: id,
        after: { customerId, amount: fine.amount.toFixed(2), invoiceId: targetInvoiceId },
      },
      tx,
    );
    return targetInvoiceId;
  });

  void invoiceId;
  const updated = await prisma.trafficFine.findUniqueOrThrow({ where: { id } });
  return toView(updated);
}

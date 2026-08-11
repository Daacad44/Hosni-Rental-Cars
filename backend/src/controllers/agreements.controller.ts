import type { Request, Response } from 'express';
import type {
  CheckoutRequest,
  CheckinRequest,
  ExtendAgreementRequest,
  AgreementFilters,
} from '@hosni/shared';
import * as agreements from '../services/agreements.service.js';
import { agreementContractPdf, invoiceReceiptPdf } from '../services/pdf.service.js';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

function sendPdf(res: Response, name: string, buffer: Buffer): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.send(buffer);
}

export async function contractPdf(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const pdf = await agreementContractPdf(actor, req.params.id as string);
  sendPdf(res, `contract-${req.params.id}.pdf`, pdf);
}

export async function receiptPdf(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const invoice = await prisma.invoice.findFirst({
    where: { agreementId: req.params.id as string, organizationId: actor.organizationId },
    select: { id: true },
  });
  if (!invoice) throw notFound('Invoice not found');
  const pdf = await invoiceReceiptPdf(actor, invoice.id);
  sendPdf(res, `receipt-${invoice.id}.pdf`, pdf);
}

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<AgreementFilters>(req);
  const { rows, total } = await agreements.listAgreements(actor, filters);
  ok(res, rows, { page: filters.page, pageSize: filters.pageSize, total });
}

export async function get(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await agreements.getAgreement(actor, req.params.id as string));
}

export async function checkout(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await agreements.checkout(actor, req.body as CheckoutRequest));
}

export async function checkin(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await agreements.checkin(actor, req.params.id as string, req.body as CheckinRequest));
}

export async function settlementPreview(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await agreements.previewSettlement(actor, req.params.id as string, req.body as CheckinRequest));
}

export async function extend(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await agreements.extendAgreement(actor, req.params.id as string, req.body as ExtendAgreementRequest));
}

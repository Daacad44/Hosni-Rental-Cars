import type { Request, Response } from 'express';
import type { RecordPaymentRequest, VoidInvoiceRequest, InvoiceFilters } from '@hosni/shared';
import * as invoices from '../services/invoices.service.js';
import { ok } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<InvoiceFilters>(req);
  const { rows, total } = await invoices.listInvoices(actor, filters);
  ok(res, rows, { page: filters.page, pageSize: filters.pageSize, total });
}

export async function get(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await invoices.getInvoice(actor, req.params.id as string));
}

export async function pay(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const key = req.header('Idempotency-Key') ?? undefined;
  ok(res, await invoices.recordPayment(actor, req.params.id as string, req.body as RecordPaymentRequest, key));
}

export async function voidInvoice(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const { reason } = req.body as VoidInvoiceRequest;
  ok(res, await invoices.voidInvoice(actor, req.params.id as string, reason));
}

export async function cashSummary(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const date = (req.query.date as string) ?? new Date().toISOString();
  const branchId = req.query.branchId as string | undefined;
  ok(res, await invoices.cashSummary(actor, date, branchId));
}

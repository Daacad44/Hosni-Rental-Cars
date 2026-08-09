import type { Request, Response } from 'express';
import type { CreateExpenseRequest, ExpenseFilters, CreateFineRequest, ChargeFineRequest } from '@hosni/shared';
import * as expenses from '../services/expenses.service.js';
import * as fines from '../services/fines.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

export async function listExpenses(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<ExpenseFilters>(req);
  const { rows, total, sum } = await expenses.listExpenses(actor, filters);
  ok(res, { items: rows, sum }, { page: filters.page, pageSize: filters.pageSize, total });
}

export async function createExpense(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await expenses.createExpense(actor, req.body as CreateExpenseRequest));
}

export async function deleteExpense(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  await expenses.deleteExpense(actor, req.params.id as string);
  ok(res, { success: true });
}

export async function exportExpenses(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<ExpenseFilters>(req);
  const csv = await expenses.exportExpensesCsv(actor, filters);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
  res.send(csv);
}

export async function listFines(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const page = Number(req.query.page ?? '1');
  const pageSize = Math.min(100, Number(req.query.pageSize ?? '20'));
  const { rows, total } = await fines.listFines(actor, page, pageSize);
  ok(res, rows, { page, pageSize, total });
}

export async function createFine(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await fines.createFine(actor, req.body as CreateFineRequest));
}

export async function chargeFine(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const { customerId } = req.body as ChargeFineRequest;
  ok(res, await fines.chargeFine(actor, req.params.id as string, customerId));
}

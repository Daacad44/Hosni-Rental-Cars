import type { Request, Response } from 'express';
import type {
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFilters,
  BlockCustomerRequest,
  MergeCustomerRequest,
} from '@hosni/shared';
import * as customers from '../services/customers.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<CustomerFilters>(req);
  const { rows, total } = await customers.listCustomers(actor, filters);
  ok(res, rows, { page: filters.page, pageSize: filters.pageSize, total });
}

export async function get(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await customers.getCustomer(actor, req.params.id as string));
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await customers.createCustomer(actor, req.body as CreateCustomerRequest));
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await customers.updateCustomer(actor, req.params.id as string, req.body as UpdateCustomerRequest));
}

export async function block(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const { reason } = req.body as BlockCustomerRequest;
  ok(res, await customers.setBlocked(actor, req.params.id as string, true, reason));
}

export async function unblock(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await customers.setBlocked(actor, req.params.id as string, false));
}

export async function merge(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const { loserId } = req.body as MergeCustomerRequest;
  ok(res, await customers.mergeCustomers(actor, req.params.id as string, loserId));
}

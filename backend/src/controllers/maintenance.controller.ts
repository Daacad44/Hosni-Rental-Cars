import type { Request, Response } from 'express';
import type {
  CreateMaintenanceRequest,
  UpdateMaintenanceStatusRequest,
  MaintenanceFilters,
} from '@hosni/shared';
import * as maintenance from '../services/maintenance.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<MaintenanceFilters>(req);
  const { rows, total } = await maintenance.listMaintenance(actor, filters);
  ok(res, rows, { page: filters.page, pageSize: filters.pageSize, total });
}

export async function get(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await maintenance.getMaintenance(actor, req.params.id as string));
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await maintenance.createMaintenance(actor, req.body as CreateMaintenanceRequest));
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await maintenance.updateStatus(actor, req.params.id as string, req.body as UpdateMaintenanceStatusRequest));
}

import type { Request, Response } from 'express';
import type {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleFilters,
  OdometerUpdateRequest,
  OutOfServiceRequest,
} from '@hosni/shared';
import * as vehicles from '../services/vehicles.service.js';
import * as detail from '../services/vehicleDetail.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<VehicleFilters>(req);
  const { rows, total } = await vehicles.listVehicles(actor, filters);
  ok(res, rows, { page: filters.page, pageSize: filters.pageSize, total });
}

export async function get(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await vehicles.getVehicle(actor, req.params.id as string));
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await vehicles.createVehicle(actor, req.body as CreateVehicleRequest));
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await vehicles.updateVehicle(actor, req.params.id as string, req.body as UpdateVehicleRequest));
}

export async function updateOdometer(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await vehicles.updateOdometer(actor, req.params.id as string, req.body as OdometerUpdateRequest));
}

export async function setOutOfService(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await vehicles.setOutOfService(actor, req.params.id as string, req.body as OutOfServiceRequest));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  await vehicles.softDeleteVehicle(actor, req.params.id as string);
  ok(res, { success: true });
}

// ── Detail tabs (§5.2) ──
export async function availability(req: Request, res: Response): Promise<void> {
  ok(res, await detail.getAvailability(requireUser(req), req.params.id as string));
}

export async function rentals(req: Request, res: Response): Promise<void> {
  ok(res, await detail.listRentals(requireUser(req), req.params.id as string));
}

export async function maintenance(req: Request, res: Response): Promise<void> {
  ok(res, await detail.listMaintenance(requireUser(req), req.params.id as string));
}

export async function damages(req: Request, res: Response): Promise<void> {
  ok(res, await detail.listDamages(requireUser(req), req.params.id as string));
}

export async function repairDamage(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await detail.markDamageRepaired(actor, req.params.id as string, req.params.damageId as string));
}

export async function expenses(req: Request, res: Response): Promise<void> {
  ok(res, await detail.listExpenses(requireUser(req), req.params.id as string));
}

export async function profitability(req: Request, res: Response): Promise<void> {
  ok(res, await detail.getProfitability(requireUser(req), req.params.id as string));
}

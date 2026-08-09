import type { Request, Response } from 'express';
import type {
  CreateReservationRequest,
  ReservationFilters,
  AvailabilityQuery,
  AssignVehicleRequest,
} from '@hosni/shared';
import * as reservations from '../services/reservations.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

export async function available(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const query = getValidatedQuery<AvailabilityQuery>(req);
  ok(res, await reservations.availableVehicles(actor, query));
}

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const filters = getValidatedQuery<ReservationFilters>(req);
  const { rows, total } = await reservations.listReservations(actor, filters);
  ok(res, rows, { page: filters.page, pageSize: filters.pageSize, total });
}

export async function get(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await reservations.getReservation(actor, req.params.id as string));
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await reservations.createReservation(actor, req.body as CreateReservationRequest));
}

export async function confirm(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const body = req.body as Partial<AssignVehicleRequest>;
  ok(res, await reservations.confirmReservation(actor, req.params.id as string, body.vehicleId));
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await reservations.cancelReservation(actor, req.params.id as string));
}

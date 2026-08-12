import type { Request, Response } from 'express';
import type { CorrectInspectionRequest } from '@hosni/shared';
import * as damages from '../services/damages.service.js';
import { ok } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';

export async function listVehicleDamages(req: Request, res: Response): Promise<void> {
  ok(res, await damages.listVehicleDamages(requireUser(req), req.params.id as string));
}

export async function repairDamage(req: Request, res: Response): Promise<void> {
  ok(res, await damages.markDamageRepaired(requireUser(req), req.params.damageId as string));
}

export async function listInspections(req: Request, res: Response): Promise<void> {
  ok(res, await damages.listInspections(requireUser(req), req.params.id as string));
}

export async function correctInspection(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await damages.correctInspection(
      requireUser(req),
      req.params.id as string,
      req.params.inspectionId as string,
      req.body as CorrectInspectionRequest,
    ),
  );
}

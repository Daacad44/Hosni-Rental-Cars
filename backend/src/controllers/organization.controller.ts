import type { Request, Response } from 'express';
import type { OrgSettingsRequest } from '@hosni/shared';
import * as organization from '../services/organization.service.js';
import { ok } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';

export async function get(req: Request, res: Response): Promise<void> {
  ok(res, await organization.getOrgSettings(requireUser(req)));
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await organization.updateOrgSettings(actor, req.body as OrgSettingsRequest));
}

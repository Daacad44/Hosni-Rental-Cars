import { Router } from 'express';
import { updateOrgSettingsSchema } from '@hosni/shared';
import * as org from '../services/org.service.js';
import { authenticate, requireRole, requireUser } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler, ok } from '../lib/respond.js';

export const orgRoutes = Router();
orgRoutes.use(authenticate);

// Read is owner/manager; editing settings is owner-only (§2).
orgRoutes.get(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => ok(res, await org.getSettings(requireUser(req)))),
);
orgRoutes.patch(
  '/',
  requireRole('OWNER'),
  validateBody(updateOrgSettingsSchema),
  asyncHandler(async (req, res) => ok(res, await org.updateSettings(requireUser(req), req.body))),
);

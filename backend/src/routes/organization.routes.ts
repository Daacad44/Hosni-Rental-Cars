import { Router } from 'express';
import { orgSettingsSchema } from '@hosni/shared';
import * as organization from '../controllers/organization.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

// Organization settings are OWNER-only (§15), enforced here in middleware.
export const organizationRoutes = Router();
organizationRoutes.use(authenticate, requireRole('OWNER'));

organizationRoutes.get('/', asyncHandler(organization.get));
organizationRoutes.patch('/', validateBody(orgSettingsSchema), asyncHandler(organization.update));

import { Router } from 'express';
import { createMaintenanceSchema, updateMaintenanceStatusSchema, maintenanceFiltersSchema } from '@hosni/shared';
import * as maintenance from '../controllers/maintenance.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const maintenanceRoutes = Router();

// Vehicles and maintenance are the mechanic's domain; agents are excluded.
maintenanceRoutes.use(authenticate, requireRole('OWNER', 'MANAGER', 'MECHANIC'));

maintenanceRoutes.get('/', validateQuery(maintenanceFiltersSchema), asyncHandler(maintenance.list));
maintenanceRoutes.get('/:id', asyncHandler(maintenance.get));
maintenanceRoutes.post('/', validateBody(createMaintenanceSchema), asyncHandler(maintenance.create));
maintenanceRoutes.patch('/:id/status', validateBody(updateMaintenanceStatusSchema), asyncHandler(maintenance.updateStatus));

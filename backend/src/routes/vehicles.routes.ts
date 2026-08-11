import { Router } from 'express';
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleFiltersSchema,
  odometerUpdateSchema,
  outOfServiceSchema,
  createVehicleDocumentSchema,
} from '@hosni/shared';
import * as vehicles from '../controllers/vehicles.controller.js';
import * as media from '../controllers/vehicleMedia.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { singleUpload } from '../middleware/upload.js';
import { asyncHandler } from '../lib/respond.js';

export const vehicleRoutes = Router();

// Every route requires a session. Reads are open to all roles (branch-scoped
// for AGENT in the service); writes are the fleet/maintenance domain, so AGENT
// is excluded. Organisation scoping is enforced in the service on every query.
vehicleRoutes.use(authenticate);

const canEdit = requireRole('OWNER', 'MANAGER', 'MECHANIC');

const managerOnly = requireRole('OWNER', 'MANAGER');

vehicleRoutes.get('/', validateQuery(vehicleFiltersSchema), asyncHandler(vehicles.list));
vehicleRoutes.get('/:id', asyncHandler(vehicles.get));

// Detail tabs (§5.2). Operational tabs are readable by every role that can see
// the vehicle; the two money tabs (expenses, profitability) are manager-only,
// per §2 (AGENT has no expenses, MECHANIC has no costs).
vehicleRoutes.get('/:id/availability', asyncHandler(vehicles.availability));
vehicleRoutes.get('/:id/rentals', asyncHandler(vehicles.rentals));
vehicleRoutes.get('/:id/maintenance', asyncHandler(vehicles.maintenance));
vehicleRoutes.get('/:id/damages', asyncHandler(vehicles.damages));
vehicleRoutes.post('/:id/damages/:damageId/repair', canEdit, asyncHandler(vehicles.repairDamage));
vehicleRoutes.get('/:id/expenses', managerOnly, asyncHandler(vehicles.expenses));
vehicleRoutes.get('/:id/profitability', managerOnly, asyncHandler(vehicles.profitability));

vehicleRoutes.post('/', canEdit, validateBody(createVehicleSchema), asyncHandler(vehicles.create));
vehicleRoutes.patch('/:id', canEdit, validateBody(updateVehicleSchema), asyncHandler(vehicles.update));
vehicleRoutes.post(
  '/:id/odometer',
  canEdit,
  validateBody(odometerUpdateSchema),
  asyncHandler(vehicles.updateOdometer),
);
vehicleRoutes.post(
  '/:id/out-of-service',
  canEdit,
  validateBody(outOfServiceSchema),
  asyncHandler(vehicles.setOutOfService),
);
vehicleRoutes.delete('/:id', canEdit, asyncHandler(vehicles.remove));

// Documents
vehicleRoutes.get('/:id/documents', asyncHandler(media.listDocuments));
vehicleRoutes.post(
  '/:id/documents',
  canEdit,
  validateBody(createVehicleDocumentSchema),
  asyncHandler(media.createDocument),
);
vehicleRoutes.delete('/:id/documents/:documentId', canEdit, asyncHandler(media.deleteDocument));

// Photos
vehicleRoutes.get('/:id/photos', asyncHandler(media.listPhotos));
vehicleRoutes.post('/:id/photos', canEdit, singleUpload, asyncHandler(media.uploadPhoto));
vehicleRoutes.delete('/:id/photos/:photoId', canEdit, asyncHandler(media.deletePhoto));

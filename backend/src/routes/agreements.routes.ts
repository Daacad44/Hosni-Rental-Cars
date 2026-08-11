import { Router } from 'express';
import {
  checkoutSchema,
  checkinSchema,
  extendAgreementSchema,
  agreementFiltersSchema,
  correctInspectionSchema,
} from '@hosni/shared';
import * as agreements from '../controllers/agreements.controller.js';
import * as damages from '../controllers/damages.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const agreementRoutes = Router();

// The rental loop is the agent's domain; MECHANIC has no access.
agreementRoutes.use(authenticate, requireRole('OWNER', 'MANAGER', 'AGENT'));

agreementRoutes.get('/', validateQuery(agreementFiltersSchema), asyncHandler(agreements.list));
agreementRoutes.get('/:id', asyncHandler(agreements.get));
agreementRoutes.post('/checkout', validateBody(checkoutSchema), asyncHandler(agreements.checkout));
agreementRoutes.post(
  '/:id/settlement-preview',
  validateBody(checkinSchema),
  asyncHandler(agreements.settlementPreview),
);
agreementRoutes.post('/:id/checkin', validateBody(checkinSchema), asyncHandler(agreements.checkin));
agreementRoutes.post('/:id/extend', validateBody(extendAgreementSchema), asyncHandler(agreements.extend));

// Inspections: read the record and append a correction (never edit evidence).
agreementRoutes.get('/:id/inspections', asyncHandler(damages.listInspections));
agreementRoutes.post(
  '/:id/inspections/:inspectionId/correct',
  validateBody(correctInspectionSchema),
  asyncHandler(damages.correctInspection),
);

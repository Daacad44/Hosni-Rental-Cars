import { Router } from 'express';
import {
  checkoutSchema,
  checkinSchema,
  extendAgreementSchema,
  agreementFiltersSchema,
  correctInspectionSchema,
} from '@hosni/shared';
import * as agreements from '../controllers/agreements.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const agreementRoutes = Router();

// The rental loop is the agent's domain; MECHANIC has no access.
agreementRoutes.use(authenticate, requireRole('OWNER', 'MANAGER', 'AGENT'));

agreementRoutes.get('/', validateQuery(agreementFiltersSchema), asyncHandler(agreements.list));
agreementRoutes.get('/:id', asyncHandler(agreements.get));
agreementRoutes.get('/:id/contract.pdf', asyncHandler(agreements.contractPdf));
agreementRoutes.get('/:id/inspections', asyncHandler(agreements.listInspections));
agreementRoutes.post(
  '/:id/inspections/:inspectionId/correct',
  validateBody(correctInspectionSchema),
  asyncHandler(agreements.correctInspection),
);
agreementRoutes.post('/checkout', validateBody(checkoutSchema), asyncHandler(agreements.checkout));
agreementRoutes.post(
  '/:id/settlement-preview',
  validateBody(checkinSchema),
  asyncHandler(agreements.settlementPreview),
);
agreementRoutes.post('/:id/checkin', validateBody(checkinSchema), asyncHandler(agreements.checkin));
agreementRoutes.post('/:id/extend', validateBody(extendAgreementSchema), asyncHandler(agreements.extend));

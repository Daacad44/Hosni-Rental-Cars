import { Router } from 'express';
import { z } from 'zod';
import { rateCardSchema, quoteRequestSchema } from '@hosni/shared';
import * as pricing from '../controllers/pricing.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const rateCardRoutes = Router();
rateCardRoutes.use(authenticate);

// A card may target a specific vehicle (override) or a whole category.
const createRateCardBody = rateCardSchema.extend({
  vehicleId: z.string().nullable().optional(),
});

// Reading cards: owner and manager. Editing rates: owner only (§2).
rateCardRoutes.get('/', requireRole('OWNER', 'MANAGER'), asyncHandler(pricing.listRateCards));
rateCardRoutes.post(
  '/',
  requireRole('OWNER'),
  validateBody(createRateCardBody),
  asyncHandler(pricing.createRateCard),
);
rateCardRoutes.put(
  '/:id',
  requireRole('OWNER'),
  validateBody(rateCardSchema),
  asyncHandler(pricing.updateRateCard),
);
rateCardRoutes.delete('/:id', requireRole('OWNER'), asyncHandler(pricing.deleteRateCard));

export const quoteRoutes = Router();
quoteRoutes.use(authenticate);
// Anyone who books needs a quote; MECHANIC does not.
quoteRoutes.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'AGENT'),
  validateBody(quoteRequestSchema),
  asyncHandler(pricing.createQuote),
);

import { Router } from 'express';
import {
  createReservationSchema,
  reservationFiltersSchema,
  availabilityQuerySchema,
  assignVehicleSchema,
} from '@hosni/shared';
import * as reservations from '../controllers/reservations.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const reservationRoutes = Router();

// Bookings are the agent's domain; MECHANIC has no access.
reservationRoutes.use(authenticate, requireRole('OWNER', 'MANAGER', 'AGENT'));

reservationRoutes.get(
  '/available-vehicles',
  validateQuery(availabilityQuerySchema),
  asyncHandler(reservations.available),
);
reservationRoutes.get('/', validateQuery(reservationFiltersSchema), asyncHandler(reservations.list));
reservationRoutes.get('/:id', asyncHandler(reservations.get));
reservationRoutes.post('/', validateBody(createReservationSchema), asyncHandler(reservations.create));
reservationRoutes.post(
  '/:id/confirm',
  validateBody(assignVehicleSchema.partial()),
  asyncHandler(reservations.confirm),
);
reservationRoutes.post('/:id/cancel', asyncHandler(reservations.cancel));

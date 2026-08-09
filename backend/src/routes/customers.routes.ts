import { Router } from 'express';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFiltersSchema,
  blockCustomerSchema,
  mergeCustomerSchema,
} from '@hosni/shared';
import * as customers from '../controllers/customers.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const customerRoutes = Router();

// Customers are the agent's domain; MECHANIC has no access to customers at all.
customerRoutes.use(authenticate, requireRole('OWNER', 'MANAGER', 'AGENT'));

customerRoutes.get('/', validateQuery(customerFiltersSchema), asyncHandler(customers.list));
customerRoutes.get('/:id', asyncHandler(customers.get));
customerRoutes.post('/', validateBody(createCustomerSchema), asyncHandler(customers.create));
customerRoutes.patch('/:id', validateBody(updateCustomerSchema), asyncHandler(customers.update));
customerRoutes.post('/:id/block', validateBody(blockCustomerSchema), asyncHandler(customers.block));
customerRoutes.post('/:id/unblock', asyncHandler(customers.unblock));

// Merge takes money-relevant history from one record to another: manager only.
customerRoutes.post(
  '/:id/merge',
  requireRole('OWNER', 'MANAGER'),
  validateBody(mergeCustomerSchema),
  asyncHandler(customers.merge),
);

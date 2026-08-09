import { Router } from 'express';
import {
  createUserRequestSchema,
  updateUserRequestSchema,
  paginationQuerySchema,
} from '@hosni/shared';
import * as usersController from '../controllers/users.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const userRoutes = Router();

// User management is OWNER/MANAGER only, enforced here in middleware.
userRoutes.use(authenticate, requireRole('OWNER', 'MANAGER'));

userRoutes.get('/', validateQuery(paginationQuerySchema), asyncHandler(usersController.list));
userRoutes.post('/', validateBody(createUserRequestSchema), asyncHandler(usersController.create));
userRoutes.patch(
  '/:id',
  validateBody(updateUserRequestSchema),
  asyncHandler(usersController.update),
);
userRoutes.post('/:id/deactivate', asyncHandler(usersController.deactivate));

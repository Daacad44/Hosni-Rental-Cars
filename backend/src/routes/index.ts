import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './users.routes.js';
import { vehicleRoutes } from './vehicles.routes.js';
import { branchRoutes } from './branches.routes.js';
import { customerRoutes } from './customers.routes.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../lib/respond.js';
import * as files from '../controllers/files.controller.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/vehicles', vehicleRoutes);
apiRouter.use('/branches', branchRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.get('/files', authenticate, asyncHandler(files.download));

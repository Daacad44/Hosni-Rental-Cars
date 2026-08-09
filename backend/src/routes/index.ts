import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './users.routes.js';
import { vehicleRoutes } from './vehicles.routes.js';
import { branchRoutes } from './branches.routes.js';
import { customerRoutes } from './customers.routes.js';
import { rateCardRoutes, quoteRoutes } from './pricing.routes.js';
import { reservationRoutes } from './reservations.routes.js';
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
apiRouter.use('/rate-cards', rateCardRoutes);
apiRouter.use('/quotes', quoteRoutes);
apiRouter.use('/reservations', reservationRoutes);
apiRouter.get('/files', authenticate, asyncHandler(files.download));

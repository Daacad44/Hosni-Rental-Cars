import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './users.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);

import { Router } from 'express';
import * as insights from '../controllers/insights.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { asyncHandler } from '../lib/respond.js';

// Dashboard and the alert panel are visible to every signed-in user.
export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate);
dashboardRoutes.get('/', asyncHandler(insights.dashboard));

export const alertRoutes = Router();
alertRoutes.use(authenticate);
alertRoutes.get('/', asyncHandler(insights.alerts));

// Reports are manager-and-above; exports use the same scoping as the screen.
export const reportRoutes = Router();
reportRoutes.use(authenticate, requireRole('OWNER', 'MANAGER'));
reportRoutes.get('/revenue', asyncHandler(insights.revenue));
reportRoutes.get('/profitability', asyncHandler(insights.profitability));
reportRoutes.get('/outstanding', asyncHandler(insights.outstanding));
reportRoutes.get('/overdue', asyncHandler(insights.overdue));

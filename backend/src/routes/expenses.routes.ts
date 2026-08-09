import { Router } from 'express';
import { createExpenseSchema, expenseFiltersSchema, createFineSchema, chargeFineSchema } from '@hosni/shared';
import * as ctrl from '../controllers/expenses.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const expenseRoutes = Router();
// Expenses and costs are owner/manager only (§2: AGENT no expenses, MECHANIC no costs).
expenseRoutes.use(authenticate, requireRole('OWNER', 'MANAGER'));

expenseRoutes.get('/', validateQuery(expenseFiltersSchema), asyncHandler(ctrl.listExpenses));
expenseRoutes.get('/export', validateQuery(expenseFiltersSchema), asyncHandler(ctrl.exportExpenses));
expenseRoutes.post('/', validateBody(createExpenseSchema), asyncHandler(ctrl.createExpense));
expenseRoutes.delete('/:id', asyncHandler(ctrl.deleteExpense));

export const fineRoutes = Router();
fineRoutes.use(authenticate, requireRole('OWNER', 'MANAGER'));

fineRoutes.get('/', asyncHandler(ctrl.listFines));
fineRoutes.post('/', validateBody(createFineSchema), asyncHandler(ctrl.createFine));
// Charging a fine to a customer moves money — manager only (already gated above).
fineRoutes.post('/:id/charge', validateBody(chargeFineSchema), asyncHandler(ctrl.chargeFine));

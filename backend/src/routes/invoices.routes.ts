import { Router } from 'express';
import { recordPaymentSchema, voidInvoiceSchema, invoiceFiltersSchema } from '@hosni/shared';
import * as invoices from '../controllers/invoices.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../lib/respond.js';

export const invoiceRoutes = Router();

// Money handling: agents record payments; MECHANIC has no access.
invoiceRoutes.use(authenticate, requireRole('OWNER', 'MANAGER', 'AGENT'));

invoiceRoutes.get('/cash-summary', asyncHandler(invoices.cashSummary));
invoiceRoutes.get('/', validateQuery(invoiceFiltersSchema), asyncHandler(invoices.list));
invoiceRoutes.get('/:id', asyncHandler(invoices.get));
invoiceRoutes.post('/:id/payments', validateBody(recordPaymentSchema), asyncHandler(invoices.pay));

// Voiding requires a manager and a reason.
invoiceRoutes.post(
  '/:id/void',
  requireRole('OWNER', 'MANAGER'),
  validateBody(voidInvoiceSchema),
  asyncHandler(invoices.voidInvoice),
);

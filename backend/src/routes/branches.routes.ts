import { Router } from 'express';
import { authenticate, requireUser } from '../middleware/authenticate.js';
import { asyncHandler, ok } from '../lib/respond.js';
import { listBranches } from '../services/branches.service.js';

export const branchRoutes = Router();

branchRoutes.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    ok(res, await listBranches(requireUser(req)));
  }),
);

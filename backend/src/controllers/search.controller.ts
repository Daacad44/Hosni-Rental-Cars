import type { Request, Response } from 'express';
import * as search from '../services/search.service.js';
import { ok } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';

export async function global(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  ok(res, await search.search(actor, q));
}

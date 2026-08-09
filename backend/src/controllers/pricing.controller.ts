import type { Request, Response } from 'express';
import type { QuoteRequest, RateCardRequest } from '@hosni/shared';
import * as rateCards from '../services/rateCards.service.js';
import * as quotes from '../services/quotes.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';

export async function listRateCards(req: Request, res: Response): Promise<void> {
  ok(res, await rateCards.listRateCards(requireUser(req)));
}

export async function createRateCard(req: Request, res: Response): Promise<void> {
  const body = req.body as RateCardRequest & { vehicleId?: string | null };
  created(res, await rateCards.createRateCard(requireUser(req), body, body.vehicleId ?? null));
}

export async function updateRateCard(req: Request, res: Response): Promise<void> {
  ok(res, await rateCards.updateRateCard(requireUser(req), req.params.id as string, req.body as RateCardRequest));
}

export async function deleteRateCard(req: Request, res: Response): Promise<void> {
  await rateCards.deleteRateCard(requireUser(req), req.params.id as string);
  ok(res, { success: true });
}

export async function createQuote(req: Request, res: Response): Promise<void> {
  ok(res, await quotes.quote(requireUser(req), req.body as QuoteRequest));
}

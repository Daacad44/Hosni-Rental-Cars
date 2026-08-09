import type { Request, Response } from 'express';
import * as reports from '../services/reports.service.js';
import { listAlerts } from '../services/alerts.service.js';
import { ok } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';

export async function alerts(req: Request, res: Response): Promise<void> {
  ok(res, await listAlerts(requireUser(req)));
}

export async function dashboard(req: Request, res: Response): Promise<void> {
  ok(res, await reports.dashboard(requireUser(req)));
}

export async function revenue(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();
  const from = req.query.from ? new Date(req.query.from as string) : new Date(to.getTime() - 30 * 86400000);
  ok(res, await reports.revenueReport(actor, from, to));
}

export async function profitability(req: Request, res: Response): Promise<void> {
  ok(res, await reports.profitabilityReport(requireUser(req)));
}

export async function outstanding(req: Request, res: Response): Promise<void> {
  ok(res, await reports.outstandingReport(requireUser(req)));
}

export async function overdue(req: Request, res: Response): Promise<void> {
  ok(res, await reports.overdueReport(requireUser(req)));
}

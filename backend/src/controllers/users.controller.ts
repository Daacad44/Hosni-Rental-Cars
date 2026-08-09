import type { Request, Response } from 'express';
import type { CreateUserRequest, UpdateUserRequest, PaginationQuery } from '@hosni/shared';
import * as usersService from '../services/users.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { getValidatedQuery } from '../middleware/validate.js';

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const query = getValidatedQuery<PaginationQuery>(req);
  const { rows, total } = await usersService.listUsers(actor.organizationId, query);
  ok(res, rows, { page: query.page, pageSize: query.pageSize, total });
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const user = await usersService.createUser(actor, req.body as CreateUserRequest);
  created(res, user);
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const { id } = req.params as { id: string };
  const user = await usersService.updateUser(actor, id, req.body as UpdateUserRequest);
  ok(res, user);
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const { id } = req.params as { id: string };
  const user = await usersService.deactivateUser(actor, id);
  ok(res, user);
}

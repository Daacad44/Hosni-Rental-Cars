import type { Request, Response } from 'express';
import { requireUser } from '../middleware/authenticate.js';
import { created } from '../lib/respond.js';
import { AppError, notFound } from '../lib/AppError.js';
import { env } from '../config/env.js';
import { storage, makeKey } from '../services/storage/index.js';
import { LocalStorageAdapter, verifyKeySignature } from '../services/storage/localAdapter.js';

/** Generic authenticated upload: stores a file privately, returns its key. */
export async function upload(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const file = req.file;
  if (!file) throw new AppError('VALIDATION_ERROR', 'A file is required');
  const key = makeKey(actor.organizationId, 'inspections', file.mimetype);
  const stored = await storage().put(key, file.buffer, file.mimetype);
  created(res, { storageKey: stored.key });
}

/**
 * Serves a locally-stored object for a valid, unexpired signature. Only used by
 * the local storage driver; in production S3 issues its own presigned URLs and
 * this route is never hit. The key is org-prefixed, so a signed URL for one
 * organization cannot read another's file even with a valid session.
 */
export async function download(req: Request, res: Response): Promise<void> {
  if (env.STORAGE_DRIVER !== 'local') throw notFound();

  const actor = requireUser(req);
  const { key, expires, sig } = req.query as { key?: string; expires?: string; sig?: string };
  if (!key || !expires || !sig) throw new AppError('VALIDATION_ERROR', 'Missing file parameters');

  if (!verifyKeySignature(key, Number(expires), sig)) throw notFound();
  if (!key.startsWith(`${actor.organizationId}/`)) throw notFound();

  const adapter = new LocalStorageAdapter();
  try {
    const buffer = await adapter.read(key);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buffer);
  } catch {
    throw notFound('File not found');
  }
}

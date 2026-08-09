import type { Request, Response } from 'express';
import type { CreateVehicleDocumentRequest } from '@hosni/shared';
import * as documents from '../services/vehicleDocuments.service.js';
import * as photos from '../services/vehiclePhotos.service.js';
import { ok, created } from '../lib/respond.js';
import { requireUser } from '../middleware/authenticate.js';
import { AppError } from '../lib/AppError.js';

// ── Documents ──
export async function listDocuments(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await documents.listDocuments(actor, req.params.id as string));
}

export async function createDocument(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  created(res, await documents.createDocument(actor, req.params.id as string, req.body as CreateVehicleDocumentRequest));
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  await documents.deleteDocument(actor, req.params.id as string, req.params.documentId as string);
  ok(res, { success: true });
}

// ── Photos ──
export async function listPhotos(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  ok(res, await photos.listPhotos(actor, req.params.id as string));
}

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const file = req.file;
  if (!file) throw new AppError('VALIDATION_ERROR', 'A photo file is required');
  created(res, await photos.addPhoto(actor, req.params.id as string, file));
}

export async function deletePhoto(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  await photos.deletePhoto(actor, req.params.id as string, req.params.photoId as string);
  ok(res, { success: true });
}

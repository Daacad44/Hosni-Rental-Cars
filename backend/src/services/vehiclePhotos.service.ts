import { prisma } from '../lib/prisma.js';
import { notFound, conflict } from '../lib/AppError.js';
import { env } from '../config/env.js';
import { storage, makeKey } from './storage/index.js';
import type { AuthContext } from '../middleware/authenticate.js';

const MAX_PHOTOS = 10;

export interface VehiclePhotoView {
  id: string;
  url: string;
  position: number;
}

async function assertVehicle(actor: AuthContext, vehicleId: string): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!vehicle) throw notFound('Vehicle not found');
  if (actor.role === 'AGENT' && vehicle.branchId !== actor.branchId) throw notFound('Vehicle not found');
}

export async function listPhotos(
  actor: AuthContext,
  vehicleId: string,
): Promise<VehiclePhotoView[]> {
  await assertVehicle(actor, vehicleId);
  const photos = await prisma.vehiclePhoto.findMany({
    where: { vehicleId, organizationId: actor.organizationId },
    orderBy: { position: 'asc' },
  });
  return Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      url: await storage().signedUrl(p.storageKey, env.SIGNED_URL_TTL_SEC),
      position: p.position,
    })),
  );
}

export async function addPhoto(
  actor: AuthContext,
  vehicleId: string,
  file: { buffer: Buffer; mimetype: string },
): Promise<VehiclePhotoView> {
  await assertVehicle(actor, vehicleId);

  const count = await prisma.vehiclePhoto.count({
    where: { vehicleId, organizationId: actor.organizationId },
  });
  if (count >= MAX_PHOTOS) throw conflict(`A vehicle can have at most ${MAX_PHOTOS} photos`);

  const key = makeKey(actor.organizationId, `vehicles/${vehicleId}/photos`, file.mimetype);
  const stored = await storage().put(key, file.buffer, file.mimetype);

  const photo = await prisma.vehiclePhoto.create({
    data: {
      organizationId: actor.organizationId,
      vehicleId,
      storageKey: stored.key,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      position: count,
    },
  });

  return {
    id: photo.id,
    url: await storage().signedUrl(photo.storageKey, env.SIGNED_URL_TTL_SEC),
    position: photo.position,
  };
}

export async function deletePhoto(
  actor: AuthContext,
  vehicleId: string,
  photoId: string,
): Promise<void> {
  await assertVehicle(actor, vehicleId);
  const photo = await prisma.vehiclePhoto.findFirst({
    where: { id: photoId, vehicleId, organizationId: actor.organizationId },
  });
  if (!photo) throw notFound('Photo not found');
  await storage().delete(photo.storageKey);
  await prisma.vehiclePhoto.delete({ where: { id: photoId } });
}

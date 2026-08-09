import type { CreateVehicleDocumentRequest, VehicleDocumentView } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import type { AuthContext } from '../middleware/authenticate.js';

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function toView(d: {
  id: string;
  type: VehicleDocumentView['type'];
  number: string;
  issueDate: Date;
  expiryDate: Date;
  storageKey: string | null;
}): VehicleDocumentView {
  return {
    id: d.id,
    type: d.type,
    number: d.number,
    issueDate: d.issueDate.toISOString(),
    expiryDate: d.expiryDate.toISOString(),
    hasFile: d.storageKey !== null,
    daysUntilExpiry: daysUntil(d.expiryDate),
  };
}

async function assertVehicle(actor: AuthContext, vehicleId: string): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!vehicle) throw notFound('Vehicle not found');
  if (actor.role === 'AGENT' && vehicle.branchId !== actor.branchId) throw notFound('Vehicle not found');
}

export async function listDocuments(
  actor: AuthContext,
  vehicleId: string,
): Promise<VehicleDocumentView[]> {
  await assertVehicle(actor, vehicleId);
  const docs = await prisma.vehicleDocument.findMany({
    where: { vehicleId, organizationId: actor.organizationId },
    orderBy: { expiryDate: 'asc' },
  });
  return docs.map(toView);
}

export async function createDocument(
  actor: AuthContext,
  vehicleId: string,
  input: CreateVehicleDocumentRequest,
): Promise<VehicleDocumentView> {
  await assertVehicle(actor, vehicleId);
  const doc = await prisma.vehicleDocument.create({
    data: {
      organizationId: actor.organizationId,
      vehicleId,
      type: input.type,
      number: input.number,
      issueDate: new Date(input.issueDate),
      expiryDate: new Date(input.expiryDate),
      storageKey: input.storageKey ?? null,
      contentType: input.contentType ?? null,
    },
  });
  return toView(doc);
}

export async function deleteDocument(
  actor: AuthContext,
  vehicleId: string,
  documentId: string,
): Promise<void> {
  await assertVehicle(actor, vehicleId);
  const doc = await prisma.vehicleDocument.findFirst({
    where: { id: documentId, vehicleId, organizationId: actor.organizationId },
  });
  if (!doc) throw notFound('Document not found');
  await prisma.vehicleDocument.delete({ where: { id: documentId } });
}

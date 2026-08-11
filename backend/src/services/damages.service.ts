import { Prisma } from '@prisma/client';
import type { DamageView, InspectionChecklist, DamageInput } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound, conflict } from '../lib/AppError.js';
import type { AuthContext } from '../middleware/authenticate.js';

function toView(d: {
  id: string; panel: string; severity: DamageView['severity']; notes: string | null;
  chargeable: boolean; chargeAmount: Prisma.Decimal | null; repairedAt: Date | null;
}): DamageView {
  return {
    id: d.id,
    panel: d.panel as DamageView['panel'],
    severity: d.severity,
    notes: d.notes,
    chargeable: d.chargeable,
    chargeAmount: d.chargeAmount ? d.chargeAmount.toFixed(2) : null,
    isPreExisting: d.repairedAt === null,
    repairedAt: d.repairedAt ? d.repairedAt.toISOString() : null,
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

export async function listVehicleDamages(actor: AuthContext, vehicleId: string): Promise<DamageView[]> {
  await assertVehicle(actor, vehicleId);
  const damages = await prisma.damage.findMany({
    where: { vehicleId, organizationId: actor.organizationId },
    orderBy: [{ repairedAt: 'asc' }, { createdAt: 'desc' }],
  });
  return damages.map(toView);
}

/** Mark a damage repaired — it stops appearing as pre-existing next time (§5.7). */
export async function markDamageRepaired(actor: AuthContext, damageId: string): Promise<DamageView> {
  const damage = await prisma.damage.findFirst({ where: { id: damageId, organizationId: actor.organizationId } });
  if (!damage) throw notFound('Damage not found');
  if (damage.repairedAt) throw conflict('This damage is already repaired');
  const updated = await prisma.damage.update({ where: { id: damageId }, data: { repairedAt: new Date() } });
  return toView(updated);
}

export interface InspectionView {
  id: string;
  type: 'CHECKOUT' | 'CHECKIN';
  odometer: number;
  fuelEighths: number;
  checklist: InspectionChecklist;
  notes: string | null;
  supersedesId: string | null;
  createdAt: string;
}

async function assertAgreement(actor: AuthContext, agreementId: string): Promise<void> {
  const agreement = await prisma.agreement.findFirst({
    where: { id: agreementId, organizationId: actor.organizationId },
    select: { id: true, branchId: true },
  });
  if (!agreement) throw notFound('Agreement not found');
  if (actor.role === 'AGENT' && agreement.branchId !== actor.branchId) throw notFound('Agreement not found');
}

export async function listInspections(actor: AuthContext, agreementId: string): Promise<InspectionView[]> {
  await assertAgreement(actor, agreementId);
  const inspections = await prisma.inspection.findMany({
    where: { agreementId, organizationId: actor.organizationId },
    orderBy: { createdAt: 'asc' },
  });
  return inspections.map((i) => ({
    id: i.id,
    type: i.type,
    odometer: i.odometer,
    fuelEighths: i.fuelEighths,
    checklist: i.checklist as unknown as InspectionChecklist,
    notes: i.notes,
    supersedesId: i.supersedesId,
    createdAt: i.createdAt.toISOString(),
  }));
}

export interface CorrectionInput {
  odometer: number;
  fuelEighths: number;
  checklist: InspectionChecklist;
  notes?: string;
  damages?: DamageInput[];
}

/**
 * Correct an inspection append-only: a new record referencing the original via
 * supersedesId. Evidence is never edited (§5.7).
 */
export async function correctInspection(
  actor: AuthContext,
  agreementId: string,
  inspectionId: string,
  input: CorrectionInput,
): Promise<InspectionView> {
  await assertAgreement(actor, agreementId);
  const original = await prisma.inspection.findFirst({
    where: { id: inspectionId, agreementId, organizationId: actor.organizationId },
  });
  if (!original) throw notFound('Inspection not found');

  const corrected = await prisma.inspection.create({
    data: {
      organizationId: actor.organizationId,
      agreementId,
      type: original.type,
      odometer: input.odometer,
      fuelEighths: input.fuelEighths,
      checklist: input.checklist as unknown as Prisma.InputJsonValue,
      notes: input.notes ?? null,
      supersedesId: original.id,
      createdById: actor.id,
    },
  });

  return {
    id: corrected.id,
    type: corrected.type,
    odometer: corrected.odometer,
    fuelEighths: corrected.fuelEighths,
    checklist: corrected.checklist as unknown as InspectionChecklist,
    notes: corrected.notes,
    supersedesId: corrected.supersedesId,
    createdAt: corrected.createdAt.toISOString(),
  };
}

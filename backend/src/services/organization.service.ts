import { Prisma } from '@prisma/client';
import type { OrgSettingsRequest, OrgSettingsView } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

type OrgRow = Prisma.OrganizationGetPayload<object>;

function toView(org: OrgRow): OrgSettingsView {
  return {
    name: org.name,
    vatRate: org.vatRate.toFixed(2),
    graceMinutes: org.graceMinutes,
    timezone: org.timezone,
    currency: org.currency,
    serviceIntervalKm: org.serviceIntervalKm,
    serviceIntervalDays: org.serviceIntervalDays,
    serviceThresholdKm: org.serviceThresholdKm,
    serviceThresholdDays: org.serviceThresholdDays,
    fuelChargePerEighth: org.fuelChargePerEighth.toFixed(2),
  };
}

export async function getOrgSettings(actor: AuthContext): Promise<OrgSettingsView> {
  const org = await prisma.organization.findUnique({ where: { id: actor.organizationId } });
  if (!org) throw notFound('Organization not found');
  return toView(org);
}

/**
 * Update organization settings (§15). Every change is audit-logged with the
 * before/after snapshot, so a later "why is VAT 7% now?" always has an answer.
 * Only affects future pricing — existing quotes and closed agreements keep the
 * snapshot they were written with.
 */
export async function updateOrgSettings(
  actor: AuthContext,
  input: OrgSettingsRequest,
): Promise<OrgSettingsView> {
  const current = await prisma.organization.findUnique({ where: { id: actor.organizationId } });
  if (!current) throw notFound('Organization not found');

  const updated = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: actor.organizationId },
      data: {
        vatRate: new Prisma.Decimal(input.vatRate),
        graceMinutes: input.graceMinutes,
        timezone: input.timezone,
        currency: input.currency.toUpperCase(),
        serviceIntervalKm: input.serviceIntervalKm,
        serviceIntervalDays: input.serviceIntervalDays,
        serviceThresholdKm: input.serviceThresholdKm,
        serviceThresholdDays: input.serviceThresholdDays,
        fuelChargePerEighth: new Prisma.Decimal(input.fuelChargePerEighth),
      },
    });
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'ORG_SETTINGS_UPDATED',
        entityType: 'Organization',
        entityId: actor.organizationId,
        before: toView(current) as unknown as Prisma.InputJsonValue,
        after: toView(org) as unknown as Prisma.InputJsonValue,
      },
      tx,
    );
    return org;
  });

  return toView(updated);
}

import { Prisma } from '@prisma/client';
import type { OrgSettingsView, UpdateOrgSettingsRequest } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

type OrgRow = Prisma.OrganizationGetPayload<object>;

function toView(o: OrgRow): OrgSettingsView {
  return {
    id: o.id,
    name: o.name,
    timezone: o.timezone,
    currency: o.currency,
    vatRate: o.vatRate.toFixed(2),
    graceMinutes: o.graceMinutes,
    fuelChargePerEighth: o.fuelChargePerEighth.toFixed(2),
    noShowHours: o.noShowHours,
    serviceIntervalKm: o.serviceIntervalKm,
    serviceIntervalDays: o.serviceIntervalDays,
    serviceThresholdKm: o.serviceThresholdKm,
    serviceThresholdDays: o.serviceThresholdDays,
  };
}

export async function getSettings(actor: AuthContext): Promise<OrgSettingsView> {
  const org = await prisma.organization.findUnique({ where: { id: actor.organizationId } });
  if (!org) throw notFound('Organization not found');
  return toView(org);
}

/** Update organisation settings. Owner-only, audit-logged (money/config change). */
export async function updateSettings(
  actor: AuthContext,
  input: UpdateOrgSettingsRequest,
): Promise<OrgSettingsView> {
  const before = await prisma.organization.findUnique({ where: { id: actor.organizationId } });
  if (!before) throw notFound('Organization not found');

  const data: Prisma.OrganizationUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.currency !== undefined) data.currency = input.currency.toUpperCase();
  if (input.vatRate !== undefined) data.vatRate = new Prisma.Decimal(input.vatRate);
  if (input.graceMinutes !== undefined) data.graceMinutes = input.graceMinutes;
  if (input.fuelChargePerEighth !== undefined) data.fuelChargePerEighth = new Prisma.Decimal(input.fuelChargePerEighth);
  if (input.noShowHours !== undefined) data.noShowHours = input.noShowHours;
  if (input.serviceIntervalKm !== undefined) data.serviceIntervalKm = input.serviceIntervalKm;
  if (input.serviceIntervalDays !== undefined) data.serviceIntervalDays = input.serviceIntervalDays;
  if (input.serviceThresholdKm !== undefined) data.serviceThresholdKm = input.serviceThresholdKm;
  if (input.serviceThresholdDays !== undefined) data.serviceThresholdDays = input.serviceThresholdDays;

  const updated = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({ where: { id: actor.organizationId }, data });
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'ORG_SETTINGS_UPDATED',
        entityType: 'Organization',
        entityId: actor.organizationId,
        before: { vatRate: before.vatRate.toFixed(2), graceMinutes: before.graceMinutes, fuelChargePerEighth: before.fuelChargePerEighth.toFixed(2) },
        after: { vatRate: org.vatRate.toFixed(2), graceMinutes: org.graceMinutes, fuelChargePerEighth: org.fuelChargePerEighth.toFixed(2) },
      },
      tx,
    );
    return org;
  });
  return toView(updated);
}

import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings, updateOrgSettings } from '../services/organization.service.js';
import { makeUser, makeTenant } from './helpers.js';
import type { OrgSettingsRequest } from '@hosni/shared';

const NEW_SETTINGS: OrgSettingsRequest = {
  vatRate: '7.50',
  graceMinutes: 30,
  timezone: 'Africa/Nairobi',
  currency: 'eur', // lower-case on the way in
  serviceIntervalKm: 8000,
  serviceIntervalDays: 200,
  serviceThresholdKm: 750,
  serviceThresholdDays: 21,
  fuelChargePerEighth: '6.25',
};

describe('organization settings (§15)', () => {
  it('reads the defaults and updates every field, audit-logged', async () => {
    const { organizationId } = await makeTenant('OrgSettings');
    const owner = await makeUser({ organizationId, role: 'OWNER' });

    const before = await getOrgSettings(owner);
    expect(before.vatRate).toBe('5.00');
    expect(before.currency).toBe('USD');

    const updated = await updateOrgSettings(owner, NEW_SETTINGS);
    expect(updated.vatRate).toBe('7.50');
    expect(updated.currency).toBe('EUR'); // normalized upper-case
    expect(updated.graceMinutes).toBe(30);
    expect(updated.timezone).toBe('Africa/Nairobi');
    expect(updated.serviceIntervalKm).toBe(8000);
    expect(updated.fuelChargePerEighth).toBe('6.25');

    // Persisted.
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    expect(org.vatRate.toFixed(2)).toBe('7.50');
    expect(org.currency).toBe('EUR');

    // Audit trail with before/after.
    const audit = await prisma.auditLog.findFirst({ where: { organizationId, action: 'ORG_SETTINGS_UPDATED' } });
    expect(audit).not.toBeNull();
    expect((audit!.before as Record<string, unknown>).vatRate).toBe('5.00');
    expect((audit!.after as Record<string, unknown>).vatRate).toBe('7.50');
  });

  it('never touches another organization', async () => {
    const a = await makeTenant('OA');
    const b = await makeTenant('OB');
    await updateOrgSettings(await makeUser({ organizationId: a.organizationId, role: 'OWNER' }), NEW_SETTINGS);

    const orgB = await prisma.organization.findUniqueOrThrow({ where: { id: b.organizationId } });
    expect(orgB.currency).toBe('USD');
    expect(orgB.vatRate.toFixed(2)).toBe('5.00');
  });
});

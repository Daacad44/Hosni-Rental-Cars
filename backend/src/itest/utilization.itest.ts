import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, authCookie, principal, makeTenant, makeCustomer, makeVehicle, makeAgreement, makeMaintenance, type TestUser } from './helpers.js';

/**
 * Utilization = rented vehicle-days / available vehicle-days, with maintenance
 * days excluded from the denominator. Over a 10-day window: rented 5 days,
 * 2 days maintenance -> 5 / (10 - 2) = 62.5%.
 */
describe('fleet utilization report', () => {
  let org: { organizationId: string; branchId: string };
  let owner: TestUser;
  let plate: string;

  beforeEach(async () => {
    org = await makeTenant('Util');
    owner = principal({ organizationId: org.organizationId, role: 'OWNER' });
    plate = `UTIL-${Date.now().toString(36)}`;
    const vehicleId = await makeVehicle(org.organizationId, org.branchId, { plateNumber: plate });
    const customerId = await makeCustomer(org.organizationId);
    await makeAgreement(org.organizationId, org.branchId, customerId, vehicleId, {
      status: 'CLOSED',
      startAt: new Date('2025-06-01T00:00:00Z'),
      endAt: new Date('2025-06-06T00:00:00Z'),
      checkinOdometer: 10_100,
      checkinFuel: 8,
    });
    await makeMaintenance(org.organizationId, vehicleId, {
      status: 'COMPLETED',
      scheduledStart: new Date('2025-06-08T00:00:00Z'),
      scheduledEnd: new Date('2025-06-10T00:00:00Z'),
    });
  });

  it('computes rented vs available days with maintenance excluded from the denominator', async () => {
    const res = await request(app)
      .get('/api/v1/reports/utilization')
      .query({ from: '2025-06-01T00:00:00Z', to: '2025-06-11T00:00:00Z' })
      .set('Cookie', authCookie(owner));
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: { plateNumber: string }) => r.plateNumber === plate);
    expect(row.rentedDays).toBeCloseTo(5, 1);
    expect(row.availableDays).toBeCloseTo(8, 1);
    expect(row.utilizationPct).toBeCloseTo(62.5, 1);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Agent } from 'supertest';
import { prisma } from '../helpers/db.js';
import { seedOrg, createUser, login } from '../helpers/app.js';

const RATE_VALUES = {
  dailyRate: '50.00', weeklyRate: null, monthlyRate: null, includedKmPerDay: 100,
  extraKmRate: '0.25', depositAmount: '200.00', lateHourRate: '8.00',
};

describe('fleet utilization report', () => {
  let owner: Agent;

  beforeEach(async () => {
    const org = await seedOrg();
    const u = await createUser(org.organizationId, 'OWNER', null);
    owner = await login(u.email);
    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: org.organizationId, branchId: org.branchId, plateNumber: 'U-1', vin: 'V', make: 'M', model: 'X', year: 2020,
        category: 'ECONOMY', transmission: 'MANUAL', fuelType: 'PETROL', seats: 5, colour: 'W', odometer: 1000,
        acquisitionCost: '10000.00', acquisitionDate: new Date(),
      },
    });
    const customer = await prisma.customer.create({ data: { organizationId: org.organizationId, fullName: 'C', phone: '+1' } });
    // Rented 5 of the 10-day window; 2 days of maintenance excluded from denominator.
    await prisma.agreement.create({
      data: {
        organizationId: org.organizationId, branchId: org.branchId, agreementNumber: 1, customerId: customer.id, vehicleId: vehicle.id, status: 'CLOSED',
        startAt: new Date('2025-06-01T00:00:00Z'), endAt: new Date('2025-06-06T00:00:00Z'),
        checkoutOdometer: 1000, checkoutFuel: 8, rateValues: RATE_VALUES as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.maintenance.create({
      data: {
        organizationId: org.organizationId, vehicleId: vehicle.id, type: 'SERVICE', status: 'COMPLETED',
        scheduledStart: new Date('2025-06-08T00:00:00Z'), scheduledEnd: new Date('2025-06-10T00:00:00Z'),
      },
    });
  });

  it('computes rented vs available days with maintenance excluded from the denominator', async () => {
    const res = await owner.get('/api/v1/reports/utilization').query({ from: '2025-06-01T00:00:00Z', to: '2025-06-11T00:00:00Z' });
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: { plateNumber: string }) => r.plateNumber === 'U-1');
    expect(row.rentedDays).toBeCloseTo(5, 1);
    // Window 10 days minus 2 maintenance days = 8 available days.
    expect(row.availableDays).toBeCloseTo(8, 1);
    // 5 / 8 = 62.5%
    expect(row.utilizationPct).toBeCloseTo(62.5, 1);
  });
});

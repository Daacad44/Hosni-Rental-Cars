import { describe, it, expect, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Agent } from 'supertest';
import { prisma } from '../helpers/db.js';
import { seedOrg, createUser, login } from '../helpers/app.js';

const RATE_VALUES = {
  dailyRate: '50.00', weeklyRate: null, monthlyRate: null, includedKmPerDay: 100,
  extraKmRate: '0.25', depositAmount: '200.00', lateHourRate: '8.00',
};

describe('PDF generation', () => {
  let owner: Agent;
  let agreementId: string;

  beforeEach(async () => {
    const org = await seedOrg();
    const u = await createUser(org.organizationId, 'OWNER', null);
    owner = await login(u.email);
    const customer = await prisma.customer.create({ data: { organizationId: org.organizationId, fullName: 'Amina', phone: '+1' } });
    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: org.organizationId, branchId: org.branchId, plateNumber: 'P-1', vin: 'V', make: 'Toyota', model: 'Corolla', year: 2020,
        category: 'ECONOMY', transmission: 'MANUAL', fuelType: 'PETROL', seats: 5, colour: 'W', odometer: 1000,
        acquisitionCost: '10000.00', acquisitionDate: new Date(),
      },
    });
    const agreement = await prisma.agreement.create({
      data: {
        organizationId: org.organizationId, branchId: org.branchId, agreementNumber: 1, customerId: customer.id, vehicleId: vehicle.id,
        startAt: new Date(), endAt: new Date(Date.now() + 86400000), checkoutOdometer: 1000, checkoutFuel: 8,
        rateValues: RATE_VALUES as unknown as Prisma.InputJsonValue,
      },
    });
    agreementId = agreement.id;
    await prisma.invoice.create({ data: { organizationId: org.organizationId, branchId: org.branchId, invoiceNumber: 1, customerId: customer.id, agreementId: agreement.id } });
  });

  it('renders the rental contract as a valid PDF', async () => {
    const res = await owner.get(`/api/v1/agreements/${agreementId}/contract.pdf`).buffer();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    // A real PDF starts with the %PDF- magic bytes.
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../helpers/db.js';
import { seedOrg, createUser, login } from '../helpers/app.js';
import type { Agent } from 'supertest';

const RATE_VALUES = {
  dailyRate: '50.00', weeklyRate: null, monthlyRate: null, includedKmPerDay: 100,
  extraKmRate: '0.25', depositAmount: '200.00', lateHourRate: '8.00',
};

describe('customer lifetime stats', () => {
  let owner: Agent;
  let organizationId: string;
  let branchId: string;
  let customerId: string;

  beforeEach(async () => {
    const org = await seedOrg();
    organizationId = org.organizationId;
    branchId = org.branchId;
    const u = await createUser(organizationId, 'OWNER', null);
    owner = await login(u.email);
    const customer = await prisma.customer.create({ data: { organizationId, fullName: 'Amina', phone: '+1' } });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId, branchId, plateNumber: 'S-1', vin: 'V', make: 'M', model: 'X', year: 2020,
        category: 'ECONOMY', transmission: 'MANUAL', fuelType: 'PETROL', seats: 5, colour: 'W',
        odometer: 1000, acquisitionCost: '10000.00', acquisitionDate: new Date(),
      },
    });
    // One closed-late agreement with an invoice, a payment, and a damage.
    const agreement = await prisma.agreement.create({
      data: {
        organizationId, branchId, agreementNumber: 1, customerId, vehicleId: vehicle.id, status: 'CLOSED',
        startAt: new Date('2025-01-01T09:00:00Z'), endAt: new Date('2025-01-03T09:00:00Z'),
        closedAt: new Date('2025-01-04T09:00:00Z'), checkoutOdometer: 1000, checkinOdometer: 1200, checkoutFuel: 8, checkinFuel: 8,
        rateValues: RATE_VALUES as unknown as Prisma.InputJsonValue,
      },
    });
    const invoice = await prisma.invoice.create({ data: { organizationId, branchId, invoiceNumber: 1, customerId, agreementId: agreement.id } });
    await prisma.invoiceLine.createMany({
      data: [
        { organizationId, invoiceId: invoice.id, kind: 'RENTAL', description: 'r', quantity: 2, unitAmount: '50.00', amount: '100.00' },
        { organizationId, invoiceId: invoice.id, kind: 'DEPOSIT', description: 'd', quantity: 1, unitAmount: '200.00', amount: '200.00' },
      ],
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { total: '300.00', paid: '120.00', balance: '180.00' } });
    await prisma.payment.create({ data: { organizationId, invoiceId: invoice.id, amount: '120.00', method: 'CASH' } });
    await prisma.damage.create({ data: { organizationId, vehicleId: vehicle.id, agreementId: agreement.id, panel: 'FRONT_BUMPER', severity: 'MINOR' } });
  });

  it('reports rentals, spend (deposit excluded), outstanding, damages and late returns', async () => {
    const res = await owner.get(`/api/v1/customers/${customerId}`);
    expect(res.status).toBe(200);
    const { stats } = res.body.data;
    expect(stats.rentalCount).toBe(1);
    // Revenue lines only: RENTAL 100.00, DEPOSIT excluded.
    expect(stats.totalSpend).toBe('100.00');
    expect(stats.outstandingBalance).toBe('180.00');
    expect(stats.damageCount).toBe(1);
    expect(stats.lateReturnCount).toBe(1); // closed 2025-01-04 > due 2025-01-03
  });
});

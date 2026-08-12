import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, authCookie, principal, makeTenant, makeCustomer, makeVehicle, makeAgreement, makeInvoice, type TestUser } from './helpers.js';
import { prisma } from '../lib/prisma.js';

/**
 * Customer lifetime stats are aggregated in SQL. Total spend counts revenue
 * lines only (deposits excluded); a late return is one closed after its due
 * time. Asserted end to end through the API as an OWNER.
 */
describe('customer lifetime stats', () => {
  let org: { organizationId: string; branchId: string };
  let owner: TestUser;
  let customerId: string;

  beforeEach(async () => {
    org = await makeTenant('Stats');
    owner = principal({ organizationId: org.organizationId, role: 'OWNER' });
    customerId = await makeCustomer(org.organizationId, { fullName: 'Amina' });
    const vehicleId = await makeVehicle(org.organizationId, org.branchId);

    // One rental, closed a day after it was due (a late return), with an invoice,
    // a payment, and a damage.
    const agreementId = await makeAgreement(org.organizationId, org.branchId, customerId, vehicleId, {
      status: 'CLOSED',
      startAt: new Date('2025-01-01T09:00:00Z'),
      endAt: new Date('2025-01-03T09:00:00Z'),
      closedAt: new Date('2025-01-04T09:00:00Z'),
      checkinOdometer: 10_200,
      checkinFuel: 8,
    });
    const invoiceId = await makeInvoice(org.organizationId, org.branchId, customerId, { agreementId });
    await prisma.invoiceLine.createMany({
      data: [
        { organizationId: org.organizationId, invoiceId, kind: 'RENTAL', description: 'r', quantity: 2, unitAmount: '50.00', amount: '100.00' },
        { organizationId: org.organizationId, invoiceId, kind: 'DEPOSIT', description: 'd', quantity: 1, unitAmount: '200.00', amount: '200.00' },
      ],
    });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { total: '300.00', paid: '120.00', balance: '180.00' } });
    await prisma.payment.create({ data: { organizationId: org.organizationId, invoiceId, amount: '120.00', method: 'CASH' } });
    await prisma.damage.create({ data: { organizationId: org.organizationId, vehicleId, agreementId, panel: 'FRONT_BUMPER', severity: 'MINOR' } });
  });

  it('reports rentals, spend (deposit excluded), outstanding, damages and late returns', async () => {
    const res = await request(app).get(`/api/v1/customers/${customerId}`).set('Cookie', authCookie(owner));
    expect(res.status).toBe(200);
    const { stats } = res.body.data;
    expect(stats.rentalCount).toBe(1);
    expect(stats.totalSpend).toBe('100.00'); // DEPOSIT line excluded
    expect(stats.outstandingBalance).toBe('180.00');
    expect(stats.damageCount).toBe(1);
    expect(stats.lateReturnCount).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getCustomer } from '../services/customers.service.js';
import { principal, makeTenant, makeCustomer, makeVehicle, makeAgreement, makeInvoice } from './helpers.js';

/**
 * §5.3 customer stats — the aggregates must be real, not zero. This builds a
 * customer with a known history and asserts every figure: rentals, total spend
 * (deposits excluded), outstanding balance, damages attributed at check-in, and
 * late returns.
 */

const checklist = { tyres: true, lights: true, spare: true, tools: true, documents: true, cleanliness: true };

describe('customer stats aggregates (§5.3)', () => {
  it('computes rentals, spend, outstanding, damages and late returns from real data', async () => {
    const { organizationId, branchId } = await makeTenant('S');
    const owner = principal({ organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(organizationId);
    const vehicleId = await makeVehicle(organizationId, branchId);

    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-05T00:00:00Z');

    // Three rentals: one returned late, one on time, one still overdue.
    const late = await makeAgreement(organizationId, branchId, customerId, vehicleId, {
      status: 'CLOSED',
      startAt: start,
      endAt: end,
      closedAt: new Date('2025-01-05T02:00:00Z'), // after planned end → late
    });
    await makeAgreement(organizationId, branchId, customerId, vehicleId, {
      status: 'CLOSED',
      startAt: start,
      endAt: end,
      closedAt: new Date('2025-01-04T22:00:00Z'), // before planned end → on time
    });
    await makeAgreement(organizationId, branchId, customerId, vehicleId, {
      status: 'OVERDUE',
      startAt: start,
      endAt: end,
    });

    // An invoice: one real charge (150) plus a deposit (200); paid 50.
    const invoiceId = await makeInvoice(organizationId, branchId, customerId, {
      total: new Prisma.Decimal('350.00'),
      paid: new Prisma.Decimal('50.00'),
      balance: new Prisma.Decimal('300.00'),
    });
    await prisma.invoiceLine.createMany({
      data: [
        { organizationId, invoiceId, kind: 'RENTAL', description: 'r', quantity: 1, unitAmount: new Prisma.Decimal('150.00'), amount: new Prisma.Decimal('150.00') },
        { organizationId, invoiceId, kind: 'DEPOSIT', description: 'd', quantity: 1, unitAmount: new Prisma.Decimal('200.00'), amount: new Prisma.Decimal('200.00') },
      ],
    });

    // Damage: one recorded at CHECK-IN (attributed), one at CHECK-OUT (pre-existing, excluded).
    const checkin = await prisma.inspection.create({
      data: { organizationId, agreementId: late, type: 'CHECKIN', odometer: 100, fuelEighths: 8, checklist },
    });
    const checkout = await prisma.inspection.create({
      data: { organizationId, agreementId: late, type: 'CHECKOUT', odometer: 50, fuelEighths: 8, checklist },
    });
    await prisma.damage.create({
      data: { organizationId, vehicleId, agreementId: late, inspectionId: checkin.id, panel: 'BONNET', severity: 'MINOR' },
    });
    await prisma.damage.create({
      data: { organizationId, vehicleId, agreementId: late, inspectionId: checkout.id, panel: 'ROOF', severity: 'MINOR' },
    });

    const detail = await getCustomer(owner, customerId);

    expect(detail.stats.rentalCount).toBe(3);
    expect(detail.stats.lateReturnCount).toBe(2); // the late one + the overdue one
    expect(detail.stats.totalSpend).toBe('150.00'); // deposit line excluded
    expect(detail.stats.outstandingBalance).toBe('300.00');
    expect(detail.stats.damageCount).toBe(1); // only the check-in damage
  });

  it('reports zeroes for a customer with no history (but a real, non-stub path)', async () => {
    const { organizationId } = await makeTenant('S2');
    const owner = principal({ organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(organizationId);
    const detail = await getCustomer(owner, customerId);
    expect(detail.stats).toEqual({
      rentalCount: 0,
      totalSpend: '0.00',
      outstandingBalance: '0.00',
      damageCount: 0,
      lateReturnCount: 0,
    });
  });
});

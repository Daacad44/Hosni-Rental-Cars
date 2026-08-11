import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import * as detail from '../services/vehicleDetail.service.js';
import {
  app,
  authCookie,
  principal,
  makeUser,
  makeTenant,
  makeVehicle,
  makeCustomer,
  makeAgreement,
  makeMaintenance,
  makeExpense,
  makeInvoice,
} from './helpers.js';

/**
 * §5.2 vehicle detail tabs — real data behind availability, rentals,
 * maintenance, damages, expenses and profitability, plus the §5.7 damage-repair
 * transition and the tenant boundary.
 */

describe('vehicle detail tabs (§5.2) and damage repair (§5.7)', () => {
  it('rentals and maintenance tabs return the vehicle history', async () => {
    const { organizationId, branchId } = await makeTenant('V');
    const owner = principal({ organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(organizationId);
    const vehicleId = await makeVehicle(organizationId, branchId);
    await makeAgreement(organizationId, branchId, customerId, vehicleId, { status: 'CLOSED' });
    await makeMaintenance(organizationId, vehicleId, { status: 'COMPLETED', cost: new Prisma.Decimal('120.00') });

    const rentals = await detail.listRentals(owner, vehicleId);
    expect(rentals).toHaveLength(1);
    const maint = await detail.listMaintenance(owner, vehicleId);
    expect(maint).toHaveLength(1);
    expect(maint[0]!.cost).toBe('120.00');
  });

  it('marks a damage repaired so it stops being active, and is idempotent', async () => {
    const { organizationId, branchId } = await makeTenant('V');
    const owner = await makeUser({ organizationId, role: 'OWNER' });
    const vehicleId = await makeVehicle(organizationId, branchId);
    const damage = await prisma.damage.create({
      data: { organizationId, vehicleId, panel: 'FRONT_BUMPER', severity: 'MODERATE' },
    });

    const before = await detail.listDamages(owner, vehicleId);
    expect(before[0]!.repairedAt).toBeNull();

    const repaired = await detail.markDamageRepaired(owner, vehicleId, damage.id);
    expect(repaired.repairedAt).not.toBeNull();

    // The stored row carries the repair time, and a second call changes nothing.
    const firstTime = (await prisma.damage.findUniqueOrThrow({ where: { id: damage.id } })).repairedAt;
    await detail.markDamageRepaired(owner, vehicleId, damage.id);
    const secondTime = (await prisma.damage.findUniqueOrThrow({ where: { id: damage.id } })).repairedAt;
    expect(secondTime?.getTime()).toBe(firstTime?.getTime());

    // Audit trail exists for the repair.
    const audit = await prisma.auditLog.findFirst({ where: { organizationId, action: 'DAMAGE_REPAIRED', entityId: damage.id } });
    expect(audit).not.toBeNull();
  });

  it('profitability nets revenue against expenses and maintenance', async () => {
    const { organizationId, branchId } = await makeTenant('V');
    const owner = principal({ organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(organizationId);
    const vehicleId = await makeVehicle(organizationId, branchId);
    const agreementId = await makeAgreement(organizationId, branchId, customerId, vehicleId, { status: 'CLOSED' });
    const invoiceId = await makeInvoice(organizationId, branchId, customerId, { agreementId });
    await prisma.invoiceLine.createMany({
      data: [
        { organizationId, invoiceId, kind: 'RENTAL', description: 'r', quantity: 1, unitAmount: new Prisma.Decimal('500.00'), amount: new Prisma.Decimal('500.00') },
        { organizationId, invoiceId, kind: 'DEPOSIT', description: 'd', quantity: 1, unitAmount: new Prisma.Decimal('200.00'), amount: new Prisma.Decimal('200.00') },
      ],
    });
    await makeExpense(organizationId, { vehicleId, amount: new Prisma.Decimal('100.00') });
    await makeMaintenance(organizationId, vehicleId, { status: 'COMPLETED', cost: new Prisma.Decimal('50.00') });

    const p = await detail.getProfitability(owner, vehicleId);
    expect(p.revenue).toBe('500.00'); // deposit excluded
    expect(p.expenses).toBe('100.00');
    expect(p.maintenance).toBe('50.00');
    expect(p.profit).toBe('350.00');
  });

  it('a foreign vehicle tab is 404, not another org’s data', async () => {
    const a = await makeTenant('VA');
    const b = await makeTenant('VB');
    const ownerA = principal({ organizationId: a.organizationId, role: 'OWNER' });
    const vehicleB = await makeVehicle(b.organizationId, b.branchId);

    for (const path of ['availability', 'rentals', 'maintenance', 'damages', 'expenses', 'profitability']) {
      const res = await request(app).get(`/api/v1/vehicles/${vehicleB}/${path}`).set('Cookie', authCookie(ownerA));
      expect(res.status, path).toBe(404);
    }
  });
});

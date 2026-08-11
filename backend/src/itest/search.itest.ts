import { describe, it, expect, beforeEach } from 'vitest';
import { search } from '../services/search.service.js';
import { principal, makeTenant, makeVehicle, makeCustomer, makeAgreement, type TestUser } from './helpers.js';

/**
 * §9 global search. Organization-scoped, role-aware (MECHANIC sees only
 * vehicles), AGENT branch-scoped, and never leaks across tenants.
 */
describe('global search (§9)', () => {
  let organizationId: string;
  let branchId: string;
  let owner: TestUser;

  beforeEach(async () => {
    ({ organizationId, branchId } = await makeTenant('SR'));
    owner = principal({ organizationId, role: 'OWNER' });
    await makeVehicle(organizationId, branchId, { plateNumber: 'MOG-4242', make: 'Toyota', model: 'RAV4' });
    await makeCustomer(organizationId, { fullName: 'Cabdi Searchable', phone: '615123456' });
  });

  it('finds vehicles by plate and customers by name', async () => {
    const byPlate = await search(owner, 'MOG-4242');
    expect(byPlate.vehicles.map((v) => v.label)).toContain('MOG-4242');

    const byName = await search(owner, 'Cabdi');
    expect(byName.customers.map((c) => c.label)).toContain('Cabdi Searchable');
  });

  it('finds an agreement by its number', async () => {
    const customerId = await makeCustomer(organizationId);
    const vehicleId = await makeVehicle(organizationId, branchId);
    await makeAgreement(organizationId, branchId, customerId, vehicleId, { agreementNumber: 321 });

    const res = await search(owner, '321');
    expect(res.agreements.map((a) => a.label)).toContain('#321');
  });

  it('returns nothing for a term shorter than two characters', async () => {
    const res = await search(owner, 'M');
    expect(res).toEqual({ vehicles: [], customers: [], agreements: [] });
  });

  it('gives a MECHANIC vehicles only — never customers', async () => {
    const mechanic = principal({ organizationId, role: 'MECHANIC', branchId });
    const res = await search(mechanic, 'MOG-4242');
    expect(res.vehicles.length).toBeGreaterThan(0);

    const nameSearch = await search(mechanic, 'Cabdi');
    expect(nameSearch.customers).toEqual([]);
  });

  it('never crosses the tenant boundary', async () => {
    const other = await makeTenant('SR2');
    const ownerB = principal({ organizationId: other.organizationId, role: 'OWNER' });
    const res = await search(ownerB, 'MOG-4242');
    expect(res.vehicles).toEqual([]);
  });
});

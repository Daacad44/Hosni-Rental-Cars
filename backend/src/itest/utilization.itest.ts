import { describe, it, expect } from 'vitest';
import { utilizationReport } from '../services/reports.service.js';
import { principal, makeTenant, makeCustomer, makeVehicle, makeAgreement, makeMaintenance } from './helpers.js';

/**
 * §5.12 fleet utilization. The defining property is that maintenance days are
 * excluded from the DENOMINATOR: a car in the workshop is not idle inventory.
 * This test pins that — the same rented span yields a higher utilization once
 * maintenance shrinks the available window.
 */
describe('fleet utilization report (§5.12)', () => {
  const from = new Date('2025-06-01T00:00:00Z');
  const to = new Date('2025-06-11T00:00:00Z'); // a 10-day window

  it('excludes maintenance days from the available-days denominator', async () => {
    const { organizationId, branchId } = await makeTenant('U');
    const owner = principal({ organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(organizationId);
    const vehicleId = await makeVehicle(organizationId, branchId, { acquisitionDate: new Date('2025-01-01T00:00:00Z') });

    // Rented 2 days.
    await makeAgreement(organizationId, branchId, customerId, vehicleId, {
      status: 'CLOSED',
      startAt: new Date('2025-06-01T00:00:00Z'),
      endAt: new Date('2025-06-03T00:00:00Z'),
      closedAt: new Date('2025-06-03T00:00:00Z'),
    });
    // In maintenance 2 days.
    await makeMaintenance(organizationId, vehicleId, {
      status: 'COMPLETED',
      scheduledStart: new Date('2025-06-05T00:00:00Z'),
      scheduledEnd: new Date('2025-06-07T00:00:00Z'),
    });

    const rows = await utilizationReport(owner, from, to);
    const row = rows.find((r) => r.vehicleId === vehicleId)!;
    expect(row.rentedDays).toBe(2);
    // 10-day window minus 2 maintenance days = 8 available days (NOT 10).
    expect(row.availableDays).toBe(8);
    // 2 / 8 = 25%. With maintenance in the denominator it would have been 20%.
    expect(row.utilizationPct).toBe(25);
  });

  it('a vehicle only counts from its acquisition date', async () => {
    const { organizationId, branchId } = await makeTenant('U2');
    const owner = principal({ organizationId, role: 'OWNER' });
    // Acquired halfway through the window (2025-06-06) → ~5 available days.
    const vehicleId = await makeVehicle(organizationId, branchId, { acquisitionDate: new Date('2025-06-06T00:00:00Z') });

    const rows = await utilizationReport(owner, from, to);
    const row = rows.find((r) => r.vehicleId === vehicleId)!;
    expect(row.availableDays).toBe(5);
    expect(row.rentedDays).toBe(0);
    expect(row.utilizationPct).toBe(0);
  });
});

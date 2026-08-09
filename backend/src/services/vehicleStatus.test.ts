import { describe, it, expect } from 'vitest';
import { deriveVehicleStatus } from './vehicleStatus.service.js';

describe('deriveVehicleStatus', () => {
  it('is AVAILABLE with no active records and no override', () => {
    expect(deriveVehicleStatus({ isOutOfService: false })).toBe('AVAILABLE');
  });

  it('OUT_OF_SERVICE overrides everything', () => {
    expect(
      deriveVehicleStatus({
        isOutOfService: true,
        hasOpenMaintenance: true,
        hasActiveAgreement: true,
        hasActiveReservation: true,
      }),
    ).toBe('OUT_OF_SERVICE');
  });

  it('follows precedence maintenance > rented > reserved', () => {
    expect(deriveVehicleStatus({ isOutOfService: false, hasOpenMaintenance: true })).toBe('MAINTENANCE');
    expect(
      deriveVehicleStatus({ isOutOfService: false, hasActiveAgreement: true, hasActiveReservation: true }),
    ).toBe('RENTED');
    expect(deriveVehicleStatus({ isOutOfService: false, hasActiveReservation: true })).toBe('RESERVED');
  });

  it('maintenance outranks an active agreement', () => {
    expect(
      deriveVehicleStatus({ isOutOfService: false, hasOpenMaintenance: true, hasActiveAgreement: true }),
    ).toBe('MAINTENANCE');
  });
});

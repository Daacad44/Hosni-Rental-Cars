import type { VehicleStatus } from '@hosni/shared';

export interface StatusInputs {
  isOutOfService: boolean;
  /** An open maintenance record covers now. Wired up in the maintenance module. */
  hasOpenMaintenance?: boolean;
  /** An active agreement covers now. Wired up in the agreements module. */
  hasActiveAgreement?: boolean;
  /** A confirmed reservation covers now. Wired up in the reservations module. */
  hasActiveReservation?: boolean;
}

/**
 * Single source of truth for a vehicle's operational status. Status is DERIVED,
 * never stored, so it can never drift from reality. OUT_OF_SERVICE is the only
 * manual override; everything else falls out of active records. Later modules
 * populate the optional inputs — the precedence lives here and nowhere else.
 */
export function deriveVehicleStatus(inputs: StatusInputs): VehicleStatus {
  if (inputs.isOutOfService) return 'OUT_OF_SERVICE';
  if (inputs.hasOpenMaintenance) return 'MAINTENANCE';
  if (inputs.hasActiveAgreement) return 'RENTED';
  if (inputs.hasActiveReservation) return 'RESERVED';
  return 'AVAILABLE';
}

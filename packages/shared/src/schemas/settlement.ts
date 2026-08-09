import type { RateValues } from './pricing.js';
import type { PricingLine } from './pricing.js';

/** Inputs to the pure settlement calculation performed at check-in. */
export interface SettlementInput {
  rates: RateValues;
  startAt: string;
  actualReturnAt: string;
  checkoutOdometer: number;
  checkinOdometer: number;
  checkoutFuelEighths: number;
  checkinFuelEighths: number;
  /** Charge per eighth of a tank when returned lower than at check-out. */
  fuelChargePerEighth: string;
  /** Sum of chargeable new-damage amounts approved by a manager. */
  damageCharges: string;
  /** Deposit held at check-out. */
  depositHeld: string;
  /** Payments already made on the invoice before settlement (usually 0). */
  priorPayments: string;
  graceMinutes: number;
  vatRatePercent: string;
}

export interface SettlementResult {
  lines: PricingLine[];
  drivenKm: number;
  fuelDiffEighths: number;
  subtotal: string;
  vat: string;
  grandTotal: string;
  depositHeld: string;
  depositApplied: string;
  depositRefund: string;
  /** Positive = customer pays now. */
  balanceDue: string;
  /** Positive = money handed back to the customer. */
  refundDue: string;
}

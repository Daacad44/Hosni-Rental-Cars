import type { SettlementInput, SettlementResult, PricingLine } from '@hosni/shared';
import { priceRental, toCents, fromCents } from './pricing.service.js';

/**
 * settlement.service.ts — the pure calculation performed at check-in. Same
 * inputs, same output, no I/O. It reprices the actual rental period (which may
 * differ from the plan), adds fuel and damage, applies VAT once, then reconciles
 * against the held deposit and any prior payments to a single balance-due or
 * refund figure the agent can read aloud to the customer.
 */
export function settle(input: SettlementInput): SettlementResult {
  const startAt = new Date(input.startAt);
  const actualReturnAt = new Date(input.actualReturnAt);
  const drivenKm = Math.max(0, input.checkinOdometer - input.checkoutOdometer);

  // Reprice the actual period without VAT; VAT is applied once at the end over
  // the full taxable subtotal (rental + fuel + damage).
  const rental = priceRental({
    startAt,
    endAt: actualReturnAt,
    rates: input.rates,
    drivenKm,
    graceMinutes: input.graceMinutes,
    vatRatePercent: '0.00',
  });

  const lines: PricingLine[] = rental.lines.filter((l) => l.kind !== 'TAX');

  // Fuel: charged only when returned lower than at check-out.
  const fuelDiffEighths = Math.max(0, input.checkoutFuelEighths - input.checkinFuelEighths);
  if (fuelDiffEighths > 0) {
    const perEighth = toCents(input.fuelChargePerEighth);
    lines.push({
      kind: 'FUEL',
      labelKey: 'settlement.line.fuel',
      quantity: fuelDiffEighths,
      unitAmount: input.fuelChargePerEighth,
      amount: fromCents(fuelDiffEighths * perEighth),
    });
  }

  // Damage: a single approved total (its make-up lives on the damage records).
  const damageCents = toCents(input.damageCharges);
  if (damageCents > 0) {
    lines.push({
      kind: 'DAMAGE',
      labelKey: 'settlement.line.damage',
      quantity: 1,
      unitAmount: input.damageCharges,
      amount: input.damageCharges,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + toCents(l.amount), 0);

  // VAT once, half-up, over the whole taxable subtotal.
  const vatPct = toCents(input.vatRatePercent); // hundredths of a percent
  const vatCents = Math.floor((subtotalCents * vatPct + 5000) / 10000);
  if (vatCents > 0) {
    lines.push({
      kind: 'TAX',
      labelKey: 'pricing.line.vat',
      quantity: 1,
      unitAmount: fromCents(vatCents),
      amount: fromCents(vatCents),
    });
  }

  const grandTotalCents = subtotalCents + vatCents;

  const depositHeldCents = toCents(input.depositHeld);
  const priorPaymentsCents = toCents(input.priorPayments);

  const owedBeforeDeposit = grandTotalCents - priorPaymentsCents;
  const depositAppliedCents = Math.max(0, Math.min(owedBeforeDeposit, depositHeldCents));
  const depositRefundCents = depositHeldCents - depositAppliedCents;
  const finalBalanceCents = owedBeforeDeposit - depositAppliedCents;

  const balanceDueCents = Math.max(0, finalBalanceCents);
  const refundDueCents = depositRefundCents + Math.max(0, -finalBalanceCents);

  return {
    lines,
    drivenKm,
    fuelDiffEighths,
    subtotal: fromCents(subtotalCents),
    vat: fromCents(vatCents),
    grandTotal: fromCents(grandTotalCents),
    depositHeld: fromCents(depositHeldCents),
    depositApplied: fromCents(depositAppliedCents),
    depositRefund: fromCents(depositRefundCents),
    balanceDue: fromCents(balanceDueCents),
    refundDue: fromCents(refundDueCents),
  };
}

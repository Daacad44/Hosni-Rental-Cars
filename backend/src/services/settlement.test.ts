import { describe, it, expect } from 'vitest';
import type { RateValues, SettlementInput } from '@hosni/shared';
import { settle } from './settlement.service.js';
import { toCents } from './pricing.service.js';

const rates: RateValues = {
  dailyRate: '50.00',
  weeklyRate: '300.00',
  monthlyRate: '1000.00',
  includedKmPerDay: 100,
  extraKmRate: '0.25',
  depositAmount: '200.00',
  lateHourRate: '8.00',
};

const start = '2025-03-01T09:00:00.000Z';
const plus = (h: number) => new Date(new Date(start).getTime() + h * 3600_000).toISOString();

function baseInput(over: Partial<SettlementInput> = {}): SettlementInput {
  return {
    rates,
    startAt: start,
    actualReturnAt: plus(24),
    checkoutOdometer: 10_000,
    checkinOdometer: 10_080, // 80 km, within 100 allowance
    checkoutFuelEighths: 8,
    checkinFuelEighths: 8,
    fuelChargePerEighth: '5.00',
    damageCharges: '0.00',
    depositHeld: '200.00',
    priorPayments: '0.00',
    graceMinutes: 59,
    vatRatePercent: '5.00',
    ...over,
  };
}

describe('settlement scenarios', () => {
  it('on time, nothing extra: one day + VAT, deposit refunded in full', () => {
    const r = settle(baseInput());
    expect(r.subtotal).toBe('50.00');
    expect(r.vat).toBe('2.50');
    expect(r.grandTotal).toBe('52.50');
    // deposit 200 covers 52.50 -> balance 0, refund 147.50
    expect(r.balanceDue).toBe('0.00');
    expect(r.refundDue).toBe('147.50');
    expect(r.depositApplied).toBe('52.50');
  });

  it('one hour late adds a beyond-grace charge', () => {
    const r = settle(baseInput({ actualReturnAt: plus(25) }));
    expect(r.lines.some((l) => l.kind === 'EXTRA_DAY')).toBe(true);
    expect(Number(r.grandTotal)).toBeGreaterThan(52.5);
  });

  it('one full day late charges a second day', () => {
    const r = settle(baseInput({ actualReturnAt: plus(48), checkinOdometer: 10_150 }));
    // 2 days = 100.00 subtotal (150 km within 200 allowance)
    expect(r.subtotal).toBe('100.00');
  });

  it('charges extra kilometres beyond the allowance', () => {
    const r = settle(baseInput({ checkinOdometer: 10_250 })); // 250 km, allowance 100
    const km = r.lines.find((l) => l.kind === 'EXTRA_KM');
    expect(km?.quantity).toBe(150);
    expect(km?.amount).toBe('37.50');
  });

  it('charges for fuel returned short', () => {
    const r = settle(baseInput({ checkinFuelEighths: 5 })); // 3 eighths short * 5.00
    const fuel = r.lines.find((l) => l.kind === 'FUEL');
    expect(fuel?.quantity).toBe(3);
    expect(fuel?.amount).toBe('15.00');
  });

  it('adds an approved damage charge', () => {
    const r = settle(baseInput({ damageCharges: '120.00' }));
    const dmg = r.lines.find((l) => l.kind === 'DAMAGE');
    expect(dmg?.amount).toBe('120.00');
  });

  it('deposit smaller than charges leaves a balance due', () => {
    // Big charges: 3 days late + damage, small deposit.
    const r = settle(
      baseInput({ actualReturnAt: plus(72), checkinOdometer: 10_500, damageCharges: '300.00', depositHeld: '100.00' }),
    );
    expect(Number(r.balanceDue)).toBeGreaterThan(0);
    expect(r.refundDue).toBe('0.00');
    expect(r.depositApplied).toBe('100.00');
  });

  it('deposit larger than charges refunds the remainder, nothing due', () => {
    const r = settle(baseInput({ depositHeld: '500.00' }));
    expect(r.balanceDue).toBe('0.00');
    expect(r.refundDue).toBe('447.50'); // 500 - 52.50
  });

  it('reconciles: grandTotal = subtotal + vat, and balance/refund are consistent', () => {
    const r = settle(baseInput({ checkinOdometer: 10_400, checkinFuelEighths: 4, damageCharges: '80.00' }));
    expect(toCents(r.grandTotal)).toBe(toCents(r.subtotal) + toCents(r.vat));
    const net = toCents(r.balanceDue) - toCents(r.refundDue);
    // net = grandTotal - depositHeld - priorPayments
    expect(net).toBe(toCents(r.grandTotal) - toCents(r.depositHeld) - 0);
  });
});

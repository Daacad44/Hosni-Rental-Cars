import { describe, it, expect } from 'vitest';
import type { RateValues } from '@hosni/shared';
import { priceRental, cheapestCombination, toCents, fromCents } from './pricing.service.js';

const base: RateValues = {
  dailyRate: '50.00',
  weeklyRate: '280.00', // a week (280) beats six separate days (300)
  monthlyRate: '1000.00', // beats 30 daily (1500) and ~4.3 weeks
  includedKmPerDay: 100,
  extraKmRate: '0.25',
  depositAmount: '200.00',
  lateHourRate: '8.00',
};

const start = new Date('2025-01-01T10:00:00.000Z');
const at = (ms: number) => new Date(start.getTime() + ms);
const HOURS = (h: number) => h * 3600_000;
const MIN = (m: number) => m * 60_000;

function sumLines(lines: { amount: string }[]): number {
  return lines.reduce((s, l) => s + toCents(l.amount), 0);
}

describe('cents helpers', () => {
  it('round-trips money strings', () => {
    expect(toCents('50.00')).toBe(5000);
    expect(toCents('0.25')).toBe(25);
    expect(fromCents(5000)).toBe('50.00');
    expect(fromCents(1)).toBe('0.01');
  });
});

describe('grace-period boundary', () => {
  it('24h 45m charges exactly one day (no extra)', () => {
    const b = priceRental({ startAt: start, endAt: at(HOURS(24) + MIN(45)), rates: base });
    expect(b.composition).toMatchObject({ days: 1, extraHours: 0 });
    expect(b.subtotal).toBe('50.00');
    expect(b.lines.every((l) => l.kind !== 'EXTRA_DAY')).toBe(true);
  });

  it('24h 61m adds a beyond-grace charge', () => {
    const b = priceRental({ startAt: start, endAt: at(HOURS(24) + MIN(61)), rates: base });
    const late = b.lines.find((l) => l.kind === 'EXTRA_DAY');
    expect(late).toBeDefined();
    // 2 hours * 8.00 = 16.00, which is below the 50.00 day cap.
    expect(late?.amount).toBe('16.00');
    expect(b.subtotal).toBe('66.00');
  });

  it('caps the beyond-grace charge at a full day', () => {
    // 20 hours over: 20 * 8.00 = 160 -> capped at the 50.00 day rate.
    const b = priceRental({ startAt: start, endAt: at(HOURS(24) + HOURS(20)), rates: base });
    const late = b.lines.find((l) => l.kind === 'EXTRA_DAY');
    expect(late?.amount).toBe('50.00');
  });
});

describe('cheapest combination', () => {
  it('picks a week when it beats six daily', () => {
    const combo = cheapestCombination(6, base);
    expect(combo).toMatchObject({ weeks: 1, days: 0, months: 0 });
    expect(combo.cents).toBe(28000);
  });

  it('picks a month when it beats weeks and days', () => {
    const combo = cheapestCombination(30, base);
    expect(combo).toMatchObject({ months: 1 });
    expect(combo.cents).toBe(100000);
  });

  it('composes 38 days as one month plus one week plus one day', () => {
    const combo = cheapestCombination(38, base);
    // 30 + 7 + 1 = 38; month(1000) + week(280) + day(50) = 1330.
    expect(combo).toMatchObject({ months: 1, weeks: 1, days: 1 });
    expect(combo.cents).toBe(133000);
  });

  it('falls back to daily when no weekly/monthly are set', () => {
    const dailyOnly: RateValues = { ...base, weeklyRate: null, monthlyRate: null };
    const combo = cheapestCombination(3, dailyOnly);
    expect(combo).toMatchObject({ days: 3, weeks: 0, months: 0 });
    expect(combo.cents).toBe(15000);
  });
});

describe('extra kilometres', () => {
  it('charges for kilometres beyond the daily allowance', () => {
    // 2 full days -> allowance 200 km; driven 350 -> 150 extra * 0.25 = 37.50
    const b = priceRental({
      startAt: start,
      endAt: at(HOURS(48)),
      rates: base,
      drivenKm: 350,
    });
    const km = b.lines.find((l) => l.kind === 'EXTRA_KM');
    expect(km?.quantity).toBe(150);
    expect(km?.amount).toBe('37.50');
  });

  it('null includedKmPerDay means unlimited — never charged (differs from zero)', () => {
    const unlimited: RateValues = { ...base, includedKmPerDay: null };
    const b = priceRental({ startAt: start, endAt: at(HOURS(48)), rates: unlimited, drivenKm: 9999 });
    expect(b.lines.some((l) => l.kind === 'EXTRA_KM')).toBe(false);

    const zero: RateValues = { ...base, includedKmPerDay: 0 };
    const bz = priceRental({ startAt: start, endAt: at(HOURS(48)), rates: zero, drivenKm: 10 });
    const km = bz.lines.find((l) => l.kind === 'EXTRA_KM');
    expect(km?.quantity).toBe(10);
  });
});

describe('totals and rounding', () => {
  it('total equals the sum of the rounded lines', () => {
    const b = priceRental({
      startAt: start,
      endAt: at(HOURS(48) + MIN(90)),
      rates: base,
      drivenKm: 500,
      vatRatePercent: '5.00',
    });
    expect(sumLines(b.lines)).toBe(toCents(b.total));
  });

  it('applies 5% exclusive VAT rounded half-up once', () => {
    // 1 day = 50.00 subtotal; VAT 5% = 2.50; total 52.50.
    const b = priceRental({ startAt: start, endAt: at(HOURS(24)), rates: base, vatRatePercent: '5.00' });
    expect(b.subtotal).toBe('50.00');
    expect(b.vat).toBe('2.50');
    expect(b.total).toBe('52.50');
  });

  it('is deterministic — same inputs, same output', () => {
    const args = { startAt: start, endAt: at(HOURS(72)), rates: base, drivenKm: 400, vatRatePercent: '5.00' };
    expect(priceRental(args)).toEqual(priceRental(args));
  });

  it('reports the deposit separately from revenue', () => {
    const b = priceRental({ startAt: start, endAt: at(HOURS(24)), rates: base });
    expect(b.deposit).toBe('200.00');
    expect(b.lines.some((l) => l.kind === 'DEPOSIT')).toBe(false);
  });
});

import type {
  RateValues,
  PricingBreakdown,
  PricingLine,
  PricingComposition,
} from '@hosni/shared';

/**
 * pricing.service.ts — a PURE function. Same inputs, same output; no database
 * reads, no clock, no I/O. It is the highest-value file in the repo: a bug here
 * is charged to a real customer standing at a desk.
 *
 * All money is handled in integer cents so nothing depends on floating point.
 * Rates are 2-dp strings multiplied by integer counts, so every line is exact;
 * the only rounding is the VAT line, rounded once, half-up.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PricingInput {
  startAt: Date;
  endAt: Date;
  rates: RateValues;
  drivenKm?: number | null;
  /** Minutes past a full day before the next day begins to be charged. */
  graceMinutes?: number;
  /** VAT percentage as a 2-dp string, e.g. "5.00". Exclusive. */
  vatRatePercent?: string;
}

// ── cents helpers ───────────────────────────────────────────────────────────

/** Parse a "1234.56" money string into integer cents. */
export function toCents(value: string): number {
  const [whole, frac = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return Math.round(cents);
}

/** Format integer cents back into a "1234.56" string. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Round-half-up of a cents amount scaled by a percentage. */
function pct(cents: number, percentTimes100: number): number {
  // cents * percent / 100, with percent itself carrying two decimals.
  // percentTimes100 is the integer hundredths of a percent (e.g. 5.00% -> 500).
  const numerator = cents * percentTimes100;
  return Math.floor((numerator + 5000) / 10000);
}

interface Choice {
  months: number;
  weeks: number;
  days: number;
  cents: number;
}

/**
 * Cheapest way to cover at least `days` whole days using month (30d), week (7d)
 * and day blocks. Weekly/monthly may be absent. Overbuying a bigger block is
 * allowed when it is cheaper — e.g. a week can beat six separate days.
 */
export function cheapestCombination(days: number, rates: RateValues): Choice {
  const daily = toCents(rates.dailyRate);
  const weekly = rates.weeklyRate ? toCents(rates.weeklyRate) : null;
  const monthly = rates.monthlyRate ? toCents(rates.monthlyRate) : null;

  if (days <= 0) return { months: 0, weeks: 0, days: 0, cents: 0 };

  // dp[d] = cheapest cost to cover AT LEAST d days.
  const dp: number[] = new Array<number>(days + 1).fill(Number.POSITIVE_INFINITY);
  const from: Array<'day' | 'week' | 'month'> = new Array(days + 1).fill('day');
  dp[0] = 0;

  for (let d = 1; d <= days; d++) {
    const viaDay = daily + dp[Math.max(0, d - 1)]!;
    if (viaDay < dp[d]!) {
      dp[d] = viaDay;
      from[d] = 'day';
    }
    if (weekly !== null) {
      const viaWeek = weekly + dp[Math.max(0, d - 7)]!;
      if (viaWeek < dp[d]!) {
        dp[d] = viaWeek;
        from[d] = 'week';
      }
    }
    if (monthly !== null) {
      const viaMonth = monthly + dp[Math.max(0, d - 30)]!;
      if (viaMonth < dp[d]!) {
        dp[d] = viaMonth;
        from[d] = 'month';
      }
    }
  }

  // Reconstruct the composition.
  let d = days;
  const choice: Choice = { months: 0, weeks: 0, days: 0, cents: dp[days]! };
  while (d > 0) {
    const step = from[d]!;
    if (step === 'month') {
      choice.months++;
      d = Math.max(0, d - 30);
    } else if (step === 'week') {
      choice.weeks++;
      d = Math.max(0, d - 7);
    } else {
      choice.days++;
      d = Math.max(0, d - 1);
    }
  }
  return choice;
}

export function priceRental(input: PricingInput): PricingBreakdown {
  const grace = input.graceMinutes ?? 59;
  const durationMs = Math.max(0, input.endAt.getTime() - input.startAt.getTime());
  const wholeDays = Math.floor(durationMs / DAY_MS);
  const remainderMinutes = Math.round((durationMs - wholeDays * DAY_MS) / 60000);
  const beyondGrace = remainderMinutes > grace;

  const daily = toCents(input.rates.dailyRate);
  const lateHour = toCents(input.rates.lateHourRate);

  const lines: PricingLine[] = [];

  // Whole-day blocks, cheapest combination.
  const combo = cheapestCombination(wholeDays, input.rates);
  if (combo.months > 0) {
    lines.push(rentalLine('pricing.line.monthly', combo.months, input.rates.monthlyRate!));
  }
  if (combo.weeks > 0) {
    lines.push(rentalLine('pricing.line.weekly', combo.weeks, input.rates.weeklyRate!));
  }
  if (combo.days > 0) {
    lines.push(rentalLine('pricing.line.daily', combo.days, input.rates.dailyRate));
  }

  // Beyond-grace remainder: lateHourRate per hour, capped at a full day.
  let extraHours = 0;
  if (beyondGrace) {
    extraHours = Math.ceil(remainderMinutes / 60);
    const hourly = extraHours * lateHour;
    const chargeCents = Math.min(hourly, daily);
    lines.push({
      kind: 'EXTRA_DAY',
      labelKey: 'pricing.line.late',
      quantity: extraHours,
      unitAmount: input.rates.lateHourRate,
      amount: fromCents(chargeCents),
    });
  }

  // Days used for included-km allowance: actual days the vehicle was held.
  const chargedDays = wholeDays + (beyondGrace ? 1 : 0);

  // Extra kilometres. null includedKmPerDay means UNLIMITED — never charged.
  if (
    input.drivenKm != null &&
    input.rates.includedKmPerDay !== null &&
    chargedDays > 0
  ) {
    const allowance = input.rates.includedKmPerDay * chargedDays;
    const extraKm = Math.max(0, input.drivenKm - allowance);
    if (extraKm > 0) {
      const rate = toCents(input.rates.extraKmRate);
      lines.push({
        kind: 'EXTRA_KM',
        labelKey: 'pricing.line.extraKm',
        quantity: extraKm,
        unitAmount: input.rates.extraKmRate,
        amount: fromCents(extraKm * rate),
      });
    }
  }

  const subtotalCents = lines.reduce((sum, l) => sum + toCents(l.amount), 0);

  // VAT line, rounded once, half-up.
  const vatPct = input.vatRatePercent ? toCents(input.vatRatePercent) : 0; // hundredths of a percent
  const vatCents = pct(subtotalCents, vatPct);
  if (vatCents > 0) {
    lines.push({
      kind: 'TAX',
      labelKey: 'pricing.line.vat',
      quantity: 1,
      unitAmount: fromCents(vatCents),
      amount: fromCents(vatCents),
    });
  }

  const totalCents = subtotalCents + vatCents;

  const composition: PricingComposition = {
    months: combo.months,
    weeks: combo.weeks,
    days: combo.days,
    extraHours,
  };

  return {
    chargedDays,
    composition,
    lines,
    subtotal: fromCents(subtotalCents),
    vat: fromCents(vatCents),
    total: fromCents(totalCents),
    deposit: fromCents(toCents(input.rates.depositAmount)),
  };
}

function rentalLine(labelKey: string, quantity: number, unit: string): PricingLine {
  return {
    kind: 'RENTAL',
    labelKey,
    quantity,
    unitAmount: unit,
    amount: fromCents(quantity * toCents(unit)),
  };
}

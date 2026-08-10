import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { PricingBreakdown } from '@hosni/shared';
import { BreakdownTable } from './BreakdownTable';

// i18n is not the unit under test: t() echoes the key, and the language is
// pinned to English so Intl currency formatting is deterministic.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const breakdown: PricingBreakdown = {
  chargedDays: 3,
  composition: { months: 0, weeks: 0, days: 3, extraHours: 0 },
  lines: [
    { kind: 'RENTAL', labelKey: 'pricing.rental', quantity: 3, unitAmount: '50.00', amount: '150.00' },
    { kind: 'TAX', labelKey: 'pricing.vat', quantity: 1, unitAmount: '7.50', amount: '7.50' },
  ],
  subtotal: '150.00',
  vat: '7.50',
  total: '157.50',
  deposit: '200.00',
};

describe('QuoteBreakdown (BreakdownTable)', () => {
  it('renders one row per pricing line with its formatted amount', () => {
    render(<BreakdownTable breakdown={breakdown} />);
    expect(screen.getByText('pricing.rental')).toBeInTheDocument();
    expect(screen.getByText('pricing.vat')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('$7.50')).toBeInTheDocument();
  });

  it('shows the per-unit multiplier only when quantity > 1', () => {
    render(<BreakdownTable breakdown={breakdown} />);
    // The RENTAL line has quantity 3, so it shows "×3 @ $50.00".
    const rentalRow = screen.getByText('pricing.rental').closest('tr');
    expect(rentalRow).not.toBeNull();
    expect(within(rentalRow as HTMLElement).getByText(/×3/)).toBeInTheDocument();
    expect(within(rentalRow as HTMLElement).getByText('$50.00')).toBeInTheDocument();

    // The VAT line has quantity 1 — no multiplier annotation.
    const vatRow = screen.getByText('pricing.vat').closest('tr');
    expect(within(vatRow as HTMLElement).queryByText(/×/)).toBeNull();
  });

  it('renders the total and deposit rows', () => {
    render(<BreakdownTable breakdown={breakdown} />);
    expect(screen.getByText('reservations.total')).toBeInTheDocument();
    expect(screen.getByText('$157.50')).toBeInTheDocument();
    expect(screen.getByText('reservations.deposit')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  it('honours a non-default currency', () => {
    render(<BreakdownTable breakdown={breakdown} currency="EUR" />);
    // Intl formats EUR for en-US as "€157.50".
    expect(screen.getByText('€157.50')).toBeInTheDocument();
  });
});

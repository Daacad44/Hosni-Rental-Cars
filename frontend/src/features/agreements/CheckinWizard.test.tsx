import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SettlementResult } from '@hosni/shared';
import { renderWithProviders } from '../../test/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

// Hoisted so the values exist before the vi.mock factories (which run at import
// time, above top-level const initialization) read them.
const { agreement, settlement, checkinMutate } = vi.hoisted(() => {
  const agreement = { id: 'a1', agreementNumber: 42, vehiclePlate: 'MOG-1001', preExistingDamages: [] as unknown[] };
  const settlement: SettlementResult = {
    lines: [{ kind: 'RENTAL', labelKey: 'pricing.rental', quantity: 1, unitAmount: '100.00', amount: '100.00' }],
    drivenKm: 500,
    fuelDiffEighths: 0,
    subtotal: '100.00',
    vat: '5.00',
    grandTotal: '105.00',
    depositHeld: '200.00',
    depositApplied: '105.00',
    depositRefund: '0.00',
    balanceDue: '60.00',
    refundDue: '0.00',
  };
  return { agreement, settlement, checkinMutate: vi.fn() };
});

vi.mock('./hooks', () => ({
  useAgreement: () => ({ data: { data: agreement }, isError: false, refetch: vi.fn() }),
  useCheckin: () => ({ mutate: checkinMutate, isPending: false, error: null }),
}));
vi.mock('../auth/hooks', () => ({
  useAuth: () => ({ data: { role: 'MANAGER' } }),
}));
vi.mock('./api', () => ({
  agreementsApi: {
    settlementPreview: vi.fn().mockResolvedValue({ data: settlement }),
  },
}));

import CheckinWizard from './CheckinWizard';

describe('CheckinWizard', () => {
  beforeEach(() => {
    checkinMutate.mockClear();
  });

  it('shows the agreement header and blocks Next on readings until an odometer is entered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckinWizard />, { route: '/rentals/a1/checkin' });

    // Header proves the agreement loaded.
    expect(screen.getByText(/#42/)).toBeInTheDocument();
    expect(screen.getByText('MOG-1001')).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'agreements.next' });
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText('agreements.odometer'), '10500');
    expect(screen.getByRole('button', { name: 'agreements.next' })).toBeEnabled();
  });

  it('defaults the payment amount to the settlement balance due', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckinWizard />, { route: '/rentals/a1/checkin' });

    await user.type(screen.getByLabelText('agreements.odometer'), '10500');
    // readings → settlement
    await user.click(screen.getByRole('button', { name: 'agreements.next' }));

    // The server-computed settlement arrives; the balance-due figure is shown.
    await waitFor(() => expect(screen.getByText('$60.00')).toBeInTheDocument());

    // settlement → payment: the amount field is pre-filled with the balance due.
    await user.click(screen.getByRole('button', { name: 'agreements.next' }));

    const amount = screen.getByLabelText('invoices.amount') as HTMLInputElement;
    expect(amount.value).toBe('60.00');
  });
});

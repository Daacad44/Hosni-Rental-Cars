import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';

// i18n echoes keys so we can assert on stable identifiers.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

// The wizard's data dependencies are mocked; the logic under test is its own
// step gating and draft persistence, not the network.
const checkoutMutate = vi.fn();
vi.mock('./hooks', () => ({
  useCheckout: () => ({ mutate: checkoutMutate, isPending: false, error: null }),
}));
vi.mock('../auth/hooks', () => ({
  useAuth: () => ({ data: { role: 'AGENT' } }),
}));
vi.mock('../customers/hooks', () => ({
  useCustomers: () => ({ data: { data: [{ id: 'c1', fullName: 'Ayaan Yusuf', phone: '615000000' }] } }),
}));
vi.mock('../reservations/api', () => ({
  reservationsApi: {
    availableVehicles: vi.fn().mockResolvedValue({ data: [] }),
    quote: vi.fn().mockResolvedValue({ data: null }),
  },
}));

import CheckoutWizard from './CheckoutWizard';

const DRAFT_KEY = 'hosni.checkout.draft';

describe('CheckoutWizard step gating', () => {
  beforeEach(() => {
    localStorage.clear();
    checkoutMutate.mockClear();
  });

  it('disables Next on the customer step until a customer is chosen', () => {
    renderWithProviders(<CheckoutWizard />);
    const next = screen.getByRole('button', { name: 'agreements.next' });
    expect(next).toBeDisabled();
  });

  it('enables Next once a customer is selected, then advances to the vehicle step', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutWizard />);

    await user.type(screen.getByPlaceholderText('reservations.selectCustomer'), 'Ayaan');
    await user.click(screen.getByRole('button', { name: /Ayaan Yusuf/ }));

    const next = screen.getByRole('button', { name: 'agreements.next' });
    expect(next).toBeEnabled();

    await user.click(next);

    // We are on the vehicle step now: its date fields are shown, and without a
    // vehicle or valid dates the gate closes again.
    expect(screen.getByText('reservations.startAt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'agreements.next' })).toBeDisabled();
  });

  it('persists the draft to localStorage so a refresh loses nothing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutWizard />);

    await user.type(screen.getByPlaceholderText('reservations.selectCustomer'), 'Ayaan');
    await user.click(screen.getByRole('button', { name: /Ayaan Yusuf/ }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}');
      expect(saved.customerId).toBe('c1');
      expect(saved.customerName).toBe('Ayaan Yusuf');
    });
  });
});

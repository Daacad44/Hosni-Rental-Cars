import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrgSettingsView } from '@hosni/shared';
import { renderWithProviders } from '../../test/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const initial: OrgSettingsView = {
  name: 'Hosni',
  vatRate: '5.00',
  graceMinutes: 59,
  timezone: 'Africa/Mogadishu',
  currency: 'USD',
  serviceIntervalKm: 5000,
  serviceIntervalDays: 180,
  serviceThresholdKm: 500,
  serviceThresholdDays: 14,
  fuelChargePerEighth: '5.00',
};

const { updateMutate } = vi.hoisted(() => ({ updateMutate: vi.fn() }));
vi.mock('./hooks', () => ({
  useOrgSettings: () => ({ isLoading: false, isError: false, data: { data: initial } }),
  useUpdateOrgSettings: () => ({ mutate: updateMutate, isPending: false, error: null }),
}));

import OrganizationSettings from './OrganizationSettings';

describe('OrganizationSettings form', () => {
  beforeEach(() => updateMutate.mockClear());

  it('seeds the fields from the loaded settings', () => {
    renderWithProviders(<OrganizationSettings />);
    expect((screen.getByLabelText('settings.org.vatRate') as HTMLInputElement).value).toBe('5.00');
    expect((screen.getByLabelText('settings.org.currency') as HTMLInputElement).value).toBe('USD');
    expect((screen.getByLabelText('settings.org.graceMinutes') as HTMLInputElement).value).toBe('59');
  });

  it('submits edited values with numeric fields coerced to numbers', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationSettings />);

    const vat = screen.getByLabelText('settings.org.vatRate');
    await user.clear(vat);
    await user.type(vat, '7.50');

    const grace = screen.getByLabelText('settings.org.graceMinutes');
    await user.clear(grace);
    await user.type(grace, '30');

    await user.click(screen.getByRole('button', { name: 'settings.org.save' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const body = updateMutate.mock.calls[0]![0];
    expect(body.vatRate).toBe('7.50');
    expect(body.graceMinutes).toBe(30); // number, not "30"
    expect(typeof body.graceMinutes).toBe('number');
  });
});

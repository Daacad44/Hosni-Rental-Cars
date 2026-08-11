import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

const results = {
  vehicles: [{ id: 'v1', label: 'MOG-4242', sublabel: 'Toyota RAV4' }],
  customers: [{ id: 'c1', label: 'Ayaan Yusuf', sublabel: '615000000' }],
  agreements: [{ id: 'a1', label: '#7', sublabel: 'OPEN' }],
};
vi.mock('../features/search/hooks', () => ({
  // Identity debounce keeps the test synchronous.
  useDebounced: (v: string) => v,
  useGlobalSearch: () => ({ isLoading: false, data: { data: results } }),
}));

import { GlobalSearch } from './GlobalSearch';

describe('GlobalSearch', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows grouped results once the term is long enough and navigates on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GlobalSearch />);

    await user.type(screen.getByPlaceholderText('search.placeholder'), 'MOG');

    // Grouped results render.
    await waitFor(() => expect(screen.getByText('MOG-4242')).toBeInTheDocument());
    expect(screen.getByText('Ayaan Yusuf')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();

    // Clicking a result navigates to its detail route.
    await user.click(screen.getByText('MOG-4242'));
    expect(navigateMock).toHaveBeenCalledWith('/fleet/v1');
  });

  it('does not open the dropdown for a single character', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GlobalSearch />);
    await user.type(screen.getByPlaceholderText('search.placeholder'), 'M');
    expect(screen.queryByText('MOG-4242')).not.toBeInTheDocument();
  });
});

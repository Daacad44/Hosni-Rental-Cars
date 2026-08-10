import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/** A fresh QueryClient per render, with retries and caching off for determinism. */
function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Render a component inside the providers the wizards depend on. */
export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string } & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { route = '/', ...rest } = options;
  const client = makeClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui, { wrapper, ...rest });
}

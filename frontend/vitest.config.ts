import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Frontend component tests run in jsdom. Scope is deliberate: only the pieces
 * with real logic — the checkout and check-in wizards (step gating, draft
 * persistence, payment defaulting) and QuoteBreakdown (line rendering). Purely
 * presentational components are not tested.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    // Clear call history between tests but keep mock implementations (a module
    // factory's mockResolvedValue must survive across tests). restoreMocks would
    // strip those implementations and make mocked APIs return undefined.
    clearMocks: true,
  },
});

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry auth/permission failures; they will not resolve.
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

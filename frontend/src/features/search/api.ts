import type { SearchResults } from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const searchApi = {
  global: (q: string) => apiRequest<SearchResults>('/search', { query: { q } }),
};

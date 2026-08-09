import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/apiClient';

export interface BranchView {
  id: string;
  name: string;
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<BranchView[]>('/branches'),
    staleTime: 5 * 60 * 1000,
  });
}

import type { Dashboard, AlertView } from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const dashboardApi = {
  get: () => apiRequest<Dashboard>('/dashboard'),
  alerts: () => apiRequest<AlertView[]>('/alerts'),
};

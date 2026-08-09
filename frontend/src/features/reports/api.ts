import type {
  RevenueReport,
  ProfitabilityRow,
  OutstandingRow,
  OverdueRow,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const reportsApi = {
  revenue: (from: string, to: string) =>
    apiRequest<RevenueReport>('/reports/revenue', { query: { from, to } }),
  profitability: () => apiRequest<ProfitabilityRow[]>('/reports/profitability'),
  outstanding: () => apiRequest<OutstandingRow[]>('/reports/outstanding'),
  overdue: () => apiRequest<OverdueRow[]>('/reports/overdue'),
};

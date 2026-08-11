import type {
  RevenueReport,
  ProfitabilityRow,
  OutstandingRow,
  OverdueRow,
  UtilizationRow,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const reportsApi = {
  revenue: (from: string, to: string) =>
    apiRequest<RevenueReport>('/reports/revenue', { query: { from, to } }),
  profitability: () => apiRequest<ProfitabilityRow[]>('/reports/profitability'),
  outstanding: () => apiRequest<OutstandingRow[]>('/reports/outstanding'),
  overdue: () => apiRequest<OverdueRow[]>('/reports/overdue'),
  utilization: (from: string, to: string) =>
    apiRequest<UtilizationRow[]>('/reports/utilization', { query: { from, to } }),
};

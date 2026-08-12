import type {
  CreateExpenseRequest,
  ExpenseView,
  CreateFineRequest,
  FineView,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const expensesApi = {
  list: (category: string | undefined, page: number, pageSize: number, vehicleId?: string) =>
    apiRequest<{ items: ExpenseView[]; sum: string }>('/expenses', { query: { category, vehicleId, page, pageSize } }),
  create: (body: CreateExpenseRequest) => apiRequest<ExpenseView>('/expenses', { method: 'POST', body }),
  remove: (id: string) => apiRequest<{ success: boolean }>(`/expenses/${id}`, { method: 'DELETE' }),
  listFines: (page: number, pageSize: number) =>
    apiRequest<FineView[]>('/fines', { query: { page, pageSize } }),
  createFine: (body: CreateFineRequest) => apiRequest<FineView>('/fines', { method: 'POST', body }),
  chargeFine: (id: string, customerId: string) =>
    apiRequest<FineView>(`/fines/${id}/charge`, { method: 'POST', body: { customerId } }),
};

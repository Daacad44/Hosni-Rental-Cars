import type {
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerListItem,
  CustomerDetail,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export interface CustomerQuery {
  q?: string;
  blocked?: string;
  page: number;
  pageSize: number;
}

export const customersApi = {
  list: (query: CustomerQuery) =>
    apiRequest<CustomerListItem[]>('/customers', {
      query: { q: query.q, blocked: query.blocked, page: query.page, pageSize: query.pageSize },
    }),
  get: (id: string) => apiRequest<CustomerDetail>(`/customers/${id}`),
  create: (body: CreateCustomerRequest) =>
    apiRequest<CustomerDetail>('/customers', { method: 'POST', body }),
  update: (id: string, body: UpdateCustomerRequest) =>
    apiRequest<CustomerDetail>(`/customers/${id}`, { method: 'PATCH', body }),
  block: (id: string, reason: string) =>
    apiRequest<CustomerDetail>(`/customers/${id}/block`, { method: 'POST', body: { reason } }),
  unblock: (id: string) =>
    apiRequest<CustomerDetail>(`/customers/${id}/unblock`, { method: 'POST' }),
  merge: (id: string, loserId: string) =>
    apiRequest<CustomerDetail>(`/customers/${id}/merge`, { method: 'POST', body: { loserId } }),
};

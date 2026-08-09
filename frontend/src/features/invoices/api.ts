import type {
  RecordPaymentRequest,
  InvoiceListItem,
  InvoiceView,
  CashSummary,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export interface InvoiceQuery {
  status?: string;
  branchId?: string;
  customerId?: string;
  page: number;
  pageSize: number;
}

export const invoicesApi = {
  list: (query: InvoiceQuery) =>
    apiRequest<InvoiceListItem[]>('/invoices', {
      query: {
        status: query.status,
        branchId: query.branchId,
        customerId: query.customerId,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),
  get: (id: string) => apiRequest<InvoiceView>(`/invoices/${id}`),
  pay: (id: string, body: RecordPaymentRequest, idempotencyKey: string) =>
    apiRequest<InvoiceView>(`/invoices/${id}/payments`, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  void: (id: string, reason: string) =>
    apiRequest<InvoiceView>(`/invoices/${id}/void`, { method: 'POST', body: { reason } }),
  cashSummary: (date: string, branchId?: string) =>
    apiRequest<CashSummary>('/invoices/cash-summary', { query: { date, branchId } }),
};

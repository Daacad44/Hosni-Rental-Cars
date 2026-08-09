import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecordPaymentRequest } from '@hosni/shared';
import { invoicesApi, type InvoiceQuery } from './api';

export function useInvoices(query: InvoiceQuery) {
  return useQuery({ queryKey: ['invoices', query], queryFn: () => invoicesApi.list(query) });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id as string),
    enabled: Boolean(id),
  });
}

// Payments are never optimistic: the UI waits for the server before updating.
export function usePayInvoice(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['invoice', id] });
    void qc.invalidateQueries({ queryKey: ['invoices'] });
  };
  return {
    pay: useMutation({
      mutationFn: ({ body, key }: { body: RecordPaymentRequest; key: string }) =>
        invoicesApi.pay(id, body, key),
      onSuccess: invalidate,
    }),
    void: useMutation({
      mutationFn: (reason: string) => invoicesApi.void(id, reason),
      onSuccess: invalidate,
    }),
  };
}

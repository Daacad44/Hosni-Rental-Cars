import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCustomerRequest, UpdateCustomerRequest } from '@hosni/shared';
import { customersApi, type CustomerQuery } from './api';

export function useCustomers(query: CustomerQuery) {
  return useQuery({ queryKey: ['customers', query], queryFn: () => customersApi.list(query) });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerRequest) => customersApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useCustomerMutation(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['customers'] });
    void qc.invalidateQueries({ queryKey: ['customer', id] });
  };
  return {
    update: useMutation({
      mutationFn: (body: UpdateCustomerRequest) => customersApi.update(id, body),
      onSuccess: invalidate,
    }),
    block: useMutation({
      mutationFn: (reason: string) => customersApi.block(id, reason),
      onSuccess: invalidate,
    }),
    unblock: useMutation({ mutationFn: () => customersApi.unblock(id), onSuccess: invalidate }),
    merge: useMutation({
      mutationFn: (loserId: string) => customersApi.merge(id, loserId),
      onSuccess: invalidate,
    }),
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateExpenseRequest, CreateFineRequest } from '@hosni/shared';
import { expensesApi } from './api';

export function useExpenses(category: string | undefined, page: number, pageSize: number) {
  return useQuery({ queryKey: ['expenses', category, page, pageSize], queryFn: () => expensesApi.list(category, page, pageSize) });
}

export function useExpenseMutation() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['expenses'] });
  return {
    create: useMutation({ mutationFn: (body: CreateExpenseRequest) => expensesApi.create(body), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => expensesApi.remove(id), onSuccess: invalidate }),
  };
}

export function useFines(page: number, pageSize: number) {
  return useQuery({ queryKey: ['fines', page, pageSize], queryFn: () => expensesApi.listFines(page, pageSize) });
}

export function useFineMutation() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['fines'] });
  return {
    create: useMutation({ mutationFn: (body: CreateFineRequest) => expensesApi.createFine(body), onSuccess: invalidate }),
    charge: useMutation({
      mutationFn: ({ id, customerId }: { id: string; customerId: string }) => expensesApi.chargeFine(id, customerId),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['fines'] });
        void qc.invalidateQueries({ queryKey: ['invoices'] });
      },
    }),
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CheckoutRequest,
  CheckinRequest,
  ExtendAgreementRequest,
  CorrectInspectionRequest,
} from '@hosni/shared';
import { agreementsApi, type AgreementQuery } from './api';

export function useAgreements(query: AgreementQuery) {
  return useQuery({ queryKey: ['agreements', query], queryFn: () => agreementsApi.list(query) });
}

export function useAgreement(id: string | undefined) {
  return useQuery({
    queryKey: ['agreement', id],
    queryFn: () => agreementsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CheckoutRequest) => agreementsApi.checkout(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agreements'] });
      void qc.invalidateQueries({ queryKey: ['vehicles'] });
      void qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

// Check-in is never optimistic: the caller awaits the server result.
export function useCheckin(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CheckinRequest) => agreementsApi.checkin(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agreements'] });
      void qc.invalidateQueries({ queryKey: ['agreement', id] });
      void qc.invalidateQueries({ queryKey: ['vehicles'] });
      void qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useExtendAgreement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExtendAgreementRequest) => agreementsApi.extend(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agreement', id] }),
  });
}

export function useInspections(id: string) {
  return useQuery({
    queryKey: ['agreement', id, 'inspections'],
    queryFn: () => agreementsApi.inspections(id),
    enabled: Boolean(id),
  });
}

export function useCorrectInspection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inspectionId, body }: { inspectionId: string; body: CorrectInspectionRequest }) =>
      agreementsApi.correctInspection(id, inspectionId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agreement', id, 'inspections'] });
      void qc.invalidateQueries({ queryKey: ['agreement', id] });
    },
  });
}

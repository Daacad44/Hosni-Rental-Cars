import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateReservationRequest } from '@hosni/shared';
import { reservationsApi, type ReservationQuery } from './api';

export function useReservations(query: ReservationQuery) {
  return useQuery({ queryKey: ['reservations', query], queryFn: () => reservationsApi.list(query) });
}

export function useReservation(id: string | undefined) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: () => reservationsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReservationRequest) => reservationsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });
}

export function useReservationMutation(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['reservations'] });
    void qc.invalidateQueries({ queryKey: ['reservation', id] });
  };
  return {
    confirm: useMutation({
      mutationFn: (vehicleId?: string) => reservationsApi.confirm(id, vehicleId),
      onSuccess: invalidate,
    }),
    cancel: useMutation({ mutationFn: () => reservationsApi.cancel(id), onSuccess: invalidate }),
  };
}

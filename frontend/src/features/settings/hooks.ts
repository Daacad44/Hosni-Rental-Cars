import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RateCardRequest } from '@hosni/shared';
import { rateCardsApi } from './api';

export function useRateCards() {
  return useQuery({ queryKey: ['rate-cards'], queryFn: () => rateCardsApi.list() });
}

export function useRateCardMutation() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['rate-cards'] });
  return {
    create: useMutation({
      mutationFn: (body: RateCardRequest & { vehicleId?: string | null }) => rateCardsApi.create(body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: RateCardRequest }) => rateCardsApi.update(id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => rateCardsApi.remove(id), onSuccess: invalidate }),
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RateCardRequest, OrgSettingsRequest } from '@hosni/shared';
import { rateCardsApi, organizationApi } from './api';

export function useOrgSettings() {
  return useQuery({ queryKey: ['org-settings'], queryFn: () => organizationApi.get() });
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrgSettingsRequest) => organizationApi.update(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-settings'] }),
  });
}

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

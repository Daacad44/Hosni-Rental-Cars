import type { RateCardRequest, RateCardView, OrgSettingsView, UpdateOrgSettingsRequest } from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const orgApi = {
  get: () => apiRequest<OrgSettingsView>('/organization'),
  update: (body: UpdateOrgSettingsRequest) => apiRequest<OrgSettingsView>('/organization', { method: 'PATCH', body }),
};

export const rateCardsApi = {
  list: () => apiRequest<RateCardView[]>('/rate-cards'),
  create: (body: RateCardRequest & { vehicleId?: string | null }) =>
    apiRequest<RateCardView>('/rate-cards', { method: 'POST', body }),
  update: (id: string, body: RateCardRequest) =>
    apiRequest<RateCardView>(`/rate-cards/${id}`, { method: 'PUT', body }),
  remove: (id: string) => apiRequest<{ success: boolean }>(`/rate-cards/${id}`, { method: 'DELETE' }),
};

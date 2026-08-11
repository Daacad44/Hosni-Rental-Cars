import type { RateCardRequest, RateCardView, OrgSettingsRequest, OrgSettingsView } from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const rateCardsApi = {
  list: () => apiRequest<RateCardView[]>('/rate-cards'),
  create: (body: RateCardRequest & { vehicleId?: string | null }) =>
    apiRequest<RateCardView>('/rate-cards', { method: 'POST', body }),
  update: (id: string, body: RateCardRequest) =>
    apiRequest<RateCardView>(`/rate-cards/${id}`, { method: 'PUT', body }),
  remove: (id: string) => apiRequest<{ success: boolean }>(`/rate-cards/${id}`, { method: 'DELETE' }),
};

export const organizationApi = {
  get: () => apiRequest<OrgSettingsView>('/organization'),
  update: (body: OrgSettingsRequest) => apiRequest<OrgSettingsView>('/organization', { method: 'PATCH', body }),
};

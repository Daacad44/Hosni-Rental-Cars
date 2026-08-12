import type {
  CheckoutRequest,
  CheckinRequest,
  ExtendAgreementRequest,
  AgreementListItem,
  AgreementDetail,
  CheckinResult,
  SettlementResult,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export interface AgreementQuery {
  status?: string;
  branchId?: string;
  vehicleId?: string;
  customerId?: string;
  page: number;
  pageSize: number;
}

export const agreementsApi = {
  list: (query: AgreementQuery) =>
    apiRequest<AgreementListItem[]>('/agreements', {
      query: {
        status: query.status,
        branchId: query.branchId,
        vehicleId: query.vehicleId,
        customerId: query.customerId,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),
  get: (id: string) => apiRequest<AgreementDetail>(`/agreements/${id}`),
  checkout: (body: CheckoutRequest) =>
    apiRequest<AgreementDetail>('/agreements/checkout', { method: 'POST', body }),
  settlementPreview: (id: string, body: CheckinRequest) =>
    apiRequest<SettlementResult>(`/agreements/${id}/settlement-preview`, { method: 'POST', body }),
  checkin: (id: string, body: CheckinRequest) =>
    apiRequest<CheckinResult>(`/agreements/${id}/checkin`, { method: 'POST', body }),
  extend: (id: string, body: ExtendAgreementRequest) =>
    apiRequest<AgreementDetail>(`/agreements/${id}/extend`, { method: 'POST', body }),
};

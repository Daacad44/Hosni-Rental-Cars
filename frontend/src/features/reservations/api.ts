import type {
  CreateReservationRequest,
  ReservationListItem,
  ReservationDetail,
  AvailableVehicle,
  PricingBreakdown,
  QuoteRequest,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export interface ReservationQuery {
  status?: string;
  branchId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export const reservationsApi = {
  list: (query: ReservationQuery) =>
    apiRequest<ReservationListItem[]>('/reservations', {
      query: {
        status: query.status,
        branchId: query.branchId,
        from: query.from,
        to: query.to,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),
  get: (id: string) => apiRequest<ReservationDetail>(`/reservations/${id}`),
  create: (body: CreateReservationRequest) =>
    apiRequest<ReservationDetail>('/reservations', { method: 'POST', body }),
  confirm: (id: string, vehicleId?: string) =>
    apiRequest<ReservationDetail>(`/reservations/${id}/confirm`, {
      method: 'POST',
      body: vehicleId ? { vehicleId } : {},
    }),
  cancel: (id: string) =>
    apiRequest<ReservationDetail>(`/reservations/${id}/cancel`, { method: 'POST' }),
  availableVehicles: (from: string, to: string, category?: string) =>
    apiRequest<AvailableVehicle[]>('/reservations/available-vehicles', {
      query: { from, to, category },
    }),
  quote: (body: QuoteRequest) => apiRequest<PricingBreakdown>('/quotes', { method: 'POST', body }),
};

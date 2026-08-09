import type {
  CreateMaintenanceRequest,
  UpdateMaintenanceStatusRequest,
  MaintenanceView,
} from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export const maintenanceApi = {
  list: (status: string | undefined, page: number, pageSize: number) =>
    apiRequest<MaintenanceView[]>('/maintenance', { query: { status, page, pageSize } }),
  create: (body: CreateMaintenanceRequest) =>
    apiRequest<MaintenanceView>('/maintenance', { method: 'POST', body }),
  updateStatus: (id: string, body: UpdateMaintenanceStatusRequest) =>
    apiRequest<MaintenanceView>(`/maintenance/${id}/status`, { method: 'PATCH', body }),
};

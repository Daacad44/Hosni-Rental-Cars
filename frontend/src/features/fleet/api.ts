import type {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleListItem,
  VehicleDetail,
  VehicleDocumentView,
  CreateVehicleDocumentRequest,
  OdometerUpdateRequest,
  OutOfServiceRequest,
  DamageView,
} from '@hosni/shared';
import { apiRequest, apiUpload } from '../../lib/apiClient';

export interface VehicleQuery {
  q?: string;
  status?: string;
  category?: string;
  branchId?: string;
  docsExpiringDays?: number;
  page: number;
  pageSize: number;
}

export interface PhotoView {
  id: string;
  url: string;
  position: number;
}

export const fleetApi = {
  list: (query: VehicleQuery) =>
    apiRequest<VehicleListItem[]>('/vehicles', {
      query: {
        q: query.q,
        status: query.status,
        category: query.category,
        branchId: query.branchId,
        docsExpiringDays: query.docsExpiringDays,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),
  get: (id: string) => apiRequest<VehicleDetail>(`/vehicles/${id}`),
  create: (body: CreateVehicleRequest) =>
    apiRequest<VehicleDetail>('/vehicles', { method: 'POST', body }),
  update: (id: string, body: UpdateVehicleRequest) =>
    apiRequest<VehicleDetail>(`/vehicles/${id}`, { method: 'PATCH', body }),
  updateOdometer: (id: string, body: OdometerUpdateRequest) =>
    apiRequest<VehicleDetail>(`/vehicles/${id}/odometer`, { method: 'POST', body }),
  setOutOfService: (id: string, body: OutOfServiceRequest) =>
    apiRequest<VehicleDetail>(`/vehicles/${id}/out-of-service`, { method: 'POST', body }),
  remove: (id: string) => apiRequest<{ success: boolean }>(`/vehicles/${id}`, { method: 'DELETE' }),

  listDocuments: (id: string) => apiRequest<VehicleDocumentView[]>(`/vehicles/${id}/documents`),
  createDocument: (id: string, body: CreateVehicleDocumentRequest) =>
    apiRequest<VehicleDocumentView>(`/vehicles/${id}/documents`, { method: 'POST', body }),
  deleteDocument: (id: string, documentId: string) =>
    apiRequest<{ success: boolean }>(`/vehicles/${id}/documents/${documentId}`, { method: 'DELETE' }),

  listDamages: (id: string) => apiRequest<DamageView[]>(`/vehicles/${id}/damages`),
  repairDamage: (id: string, damageId: string) =>
    apiRequest<DamageView>(`/vehicles/${id}/damages/${damageId}/repair`, { method: 'POST' }),

  listPhotos: (id: string) => apiRequest<PhotoView[]>(`/vehicles/${id}/photos`),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<PhotoView>(`/vehicles/${id}/photos`, form);
  },
  deletePhoto: (id: string, photoId: string) =>
    apiRequest<{ success: boolean }>(`/vehicles/${id}/photos/${photoId}`, { method: 'DELETE' }),
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  CreateVehicleDocumentRequest,
  OdometerUpdateRequest,
  OutOfServiceRequest,
} from '@hosni/shared';
import { fleetApi, type VehicleQuery } from './api';

export function useVehicles(query: VehicleQuery) {
  return useQuery({
    queryKey: ['vehicles', query],
    queryFn: () => fleetApi.list(query),
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => fleetApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVehicleRequest) => fleetApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}

export function useUpdateVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateVehicleRequest) => fleetApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vehicles'] });
      void qc.invalidateQueries({ queryKey: ['vehicle', id] });
    },
  });
}

export function useVehicleMutation(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vehicles'] });
    void qc.invalidateQueries({ queryKey: ['vehicle', id] });
  };
  return {
    odometer: useMutation({
      mutationFn: (body: OdometerUpdateRequest) => fleetApi.updateOdometer(id, body),
      onSuccess: invalidate,
    }),
    outOfService: useMutation({
      mutationFn: (body: OutOfServiceRequest) => fleetApi.setOutOfService(id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: () => fleetApi.remove(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
    }),
  };
}

export function useVehicleDocuments(id: string) {
  return useQuery({ queryKey: ['vehicle', id, 'documents'], queryFn: () => fleetApi.listDocuments(id) });
}

export function useDocumentMutation(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['vehicle', id, 'documents'] });
  return {
    create: useMutation({
      mutationFn: (body: CreateVehicleDocumentRequest) => fleetApi.createDocument(id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (documentId: string) => fleetApi.deleteDocument(id, documentId),
      onSuccess: invalidate,
    }),
  };
}

export function useVehiclePhotos(id: string) {
  return useQuery({ queryKey: ['vehicle', id, 'photos'], queryFn: () => fleetApi.listPhotos(id) });
}

export function usePhotoMutation(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['vehicle', id, 'photos'] });
  return {
    upload: useMutation({
      mutationFn: (file: File) => fleetApi.uploadPhoto(id, file),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (photoId: string) => fleetApi.deletePhoto(id, photoId),
      onSuccess: invalidate,
    }),
  };
}

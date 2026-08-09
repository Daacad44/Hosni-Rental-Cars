import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMaintenanceRequest, UpdateMaintenanceStatusRequest } from '@hosni/shared';
import { maintenanceApi } from './api';

export function useMaintenance(status: string | undefined, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['maintenance', status, page, pageSize],
    queryFn: () => maintenanceApi.list(status, page, pageSize),
  });
}

export function useMaintenanceMutation() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['maintenance'] });
    void qc.invalidateQueries({ queryKey: ['vehicles'] });
  };
  return {
    create: useMutation({
      mutationFn: (body: CreateMaintenanceRequest) => maintenanceApi.create(body),
      onSuccess: invalidate,
    }),
    updateStatus: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdateMaintenanceStatusRequest }) =>
        maintenanceApi.updateStatus(id, body),
      onSuccess: invalidate,
    }),
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserRequest, UpdateUserRequest } from '@hosni/shared';
import { usersApi } from './api';

const key = (page: number, pageSize: number) => ['users', { page, pageSize }] as const;

export function useUsers(page: number, pageSize: number) {
  return useQuery({
    queryKey: key(page, pageSize),
    queryFn: () => usersApi.list(page, pageSize),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserRequest) => usersApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserRequest }) =>
      usersApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

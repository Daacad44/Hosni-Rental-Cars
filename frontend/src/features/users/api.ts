import type { CreateUserRequest, UpdateUserRequest } from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'MECHANIC';
  branchId: string | null;
  branchName: string | null;
  locale: 'so' | 'en';
  isActive: boolean;
  createdAt: string;
}

export const usersApi = {
  list: (page: number, pageSize: number) =>
    apiRequest<UserRow[]>('/users', { query: { page, pageSize } }),
  create: (body: CreateUserRequest) =>
    apiRequest<UserRow>('/users', { method: 'POST', body }),
  update: (id: string, body: UpdateUserRequest) =>
    apiRequest<UserRow>(`/users/${id}`, { method: 'PATCH', body }),
  deactivate: (id: string) =>
    apiRequest<UserRow>(`/users/${id}/deactivate`, { method: 'POST' }),
};

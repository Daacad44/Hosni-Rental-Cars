import type { AuthUser, LoginRequest } from '@hosni/shared';
import { apiRequest } from '../../lib/apiClient';

interface AuthPayload {
  user: AuthUser;
}

export const authApi = {
  login: (body: LoginRequest) =>
    apiRequest<AuthPayload>('/auth/login', { method: 'POST', body, skipRefresh: true }),
  me: () => apiRequest<AuthPayload>('/auth/me', { skipRefresh: true }),
  logout: () => apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, LoginRequest } from '@hosni/shared';
import { authApi } from './api';
import { setLocale } from '../../i18n';

const ME_KEY = ['auth', 'me'] as const;

/** Current session. Returns undefined user when not authenticated. */
export function useAuth() {
  const query = useQuery<AuthUser | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      const res = await authApi.me();
      return res.data.user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return query;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LoginRequest) => (await authApi.login(body)).data.user,
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      setLocale(user.locale);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.clear();
    },
  });
}

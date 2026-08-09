import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@hosni/shared';
import { useAuth } from '../features/auth/hooks';
import { AppShell } from './AppShell';

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-600" />
    </div>
  );
}

/** Gates the authenticated shell. Roles are also enforced server-side. */
export function RequireAuth() {
  const { data: user, isLoading, isError } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (isError || !user) return <Navigate to="/login" replace />;

  return <AppShell user={user} />;
}

/** Route-level role guard for pages a role cannot open (defence in depth). */
export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { data: user } = useAuth();
  if (user && !allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

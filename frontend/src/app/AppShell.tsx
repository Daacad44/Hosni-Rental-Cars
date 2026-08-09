import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, X } from 'lucide-react';
import type { AuthUser } from '@hosni/shared';
import { Sidebar } from './Sidebar';
import { LanguageToggle } from './LanguageToggle';
import { useLogout } from '../features/auth/hooks';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

export function AppShell({ user }: { user: AuthUser }) {
  const { t } = useTranslation();
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:block">
        <Sidebar role={user.role} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-foreground/40"
            aria-label={t('common.cancel')}
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 start-0">
            <Sidebar role={user.role} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-topbar items-center justify-between border-b border-border bg-surface px-4">
          <div className="flex items-center gap-3">
            <button
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="text-sm font-medium text-muted">{user.organization.name}</span>
            {user.branch && (
              <span className="rounded-sm bg-surface-alt px-2 py-0.5 text-xs text-foreground">
                {user.branch.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <span className="ms-2 text-xs text-muted">{t(`roles.${user.role}`)}</span>
            </div>
            <LanguageToggle />
            <Button
              variant="ghost"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className={cn('min-h-[44px] px-3')}
              aria-label={t('auth.signOut')}
            >
              <LogOut size={18} aria-hidden />
              <span className="hidden sm:inline">{t('auth.signOut')}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

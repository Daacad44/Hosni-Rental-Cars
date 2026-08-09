import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/hooks';

/**
 * Placeholder dashboard for Module 1. The KPI cards, today's schedule, and
 * alert panel (§5.12) are built in the insight module; this confirms the shell
 * and session wiring end to end.
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: user } = useAuth();

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">{t('nav.dashboard')}</h1>
      {user && (
        <p className="mt-1 text-sm text-muted">
          {user.name} · {t(`roles.${user.role}`)}
        </p>
      )}
      <div className="mt-4 rounded-md border border-border bg-surface p-8 text-center text-sm text-muted shadow-card">
        {t('common.comingSoon')}
      </div>
    </div>
  );
}

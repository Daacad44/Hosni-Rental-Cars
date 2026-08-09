import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { dashboardApi } from './api';
import { Money } from '../../components/ui/Money';
import { ErrorState } from '../../components/ui/states';

export default function DashboardPage() {
  const { t } = useTranslation();
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => dashboardApi.alerts() });

  if (dashboard.isError) return <ErrorState onRetry={() => dashboard.refetch()} />;

  const k = dashboard.data?.data.kpis;
  const schedule = dashboard.data?.data.todaySchedule ?? [];
  const alertRows = alerts.data?.data ?? [];

  const kpi = (label: string, value: React.ReactNode) => (
    <div className="rounded-md border border-border bg-surface p-4 shadow-card">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('dashboard.title')}</h1>

      {dashboard.isLoading || !k ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-surface-alt" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpi(t('dashboard.vehiclesOut'), k.vehiclesOut)}
          {kpi(t('dashboard.available'), k.available)}
          {kpi(t('dashboard.inMaintenance'), k.inMaintenance)}
          {kpi(t('dashboard.overdue'), k.overdue)}
          {kpi(t('dashboard.todayPickups'), k.todayPickups)}
          {kpi(t('dashboard.todayReturns'), k.todayReturns)}
          {kpi(t('dashboard.revenueMtd'), <Money value={k.revenueMtd} />)}
          {kpi(t('dashboard.outstanding'), <Money value={k.outstanding} />)}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-2 text-sm font-semibold">{t('dashboard.todaySchedule')}</div>
          {schedule.length === 0 ? (
            <p className="p-4 text-sm text-muted">{t('dashboard.noSchedule')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {schedule.map((s) => (
                <li key={`${s.kind}-${s.id}`} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    <span className={'me-2 rounded-sm px-2 py-0.5 text-xs ' + (s.kind === 'PICKUP' ? 'bg-primary-100 text-primary' : 'bg-surface-alt text-accent-600')}>
                      {t(s.kind === 'PICKUP' ? 'dashboard.pickup' : 'dashboard.return')}
                    </span>
                    {s.label}
                  </span>
                  <span className="font-mono text-xs text-muted">{new Date(s.at).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-border bg-surface shadow-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm font-semibold">
            <Bell size={16} aria-hidden />
            {t('dashboard.alerts')}
          </div>
          {alertRows.length === 0 ? (
            <p className="p-4 text-sm text-muted">{t('dashboard.noAlerts')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {alertRows.map((a) => (
                <li key={a.id} className="flex items-start gap-2 px-4 py-2 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-600" aria-hidden />
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

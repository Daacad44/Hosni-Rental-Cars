import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { fleetApi } from './api';
import { agreementsApi } from '../agreements/api';
import { maintenanceApi } from '../maintenance/api';
import { expensesApi } from '../expenses/api';
import { reportsApi } from '../reports/api';
import { DamageBadge } from '../agreements/DamageList';
import { Button } from '../../components/ui/Button';
import { Money } from '../../components/ui/Money';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, TableSkeleton } from '../../components/ui/states';

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">{children}</div>;
}

export function RentalsTab({ vehicleId }: { vehicleId: string }) {
  const q = useQuery({ queryKey: ['veh-rentals', vehicleId], queryFn: () => agreementsApi.list({ vehicleId, page: 1, pageSize: 50 }) });
  if (q.isLoading) return <Panel><TableSkeleton rows={4} cols={3} /></Panel>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data?.data ?? [];
  if (rows.length === 0) return <Panel><p className="p-6 text-center text-sm text-muted">—</p></Panel>;
  return (
    <Panel>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/rentals/${r.id}`} className="flex items-center justify-between p-3 text-sm hover:bg-surface-alt">
              <span>#{r.agreementNumber} · {r.customerName}</span>
              <span className="text-xs text-muted">{new Date(r.startAt).toLocaleDateString()} → {new Date(r.endAt).toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function MaintenanceTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['veh-maint', vehicleId], queryFn: () => maintenanceApi.list(undefined, 1, 50, vehicleId) });
  if (q.isLoading) return <Panel><TableSkeleton rows={4} cols={3} /></Panel>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data?.data ?? [];
  if (rows.length === 0) return <Panel><p className="p-6 text-center text-sm text-muted">—</p></Panel>;
  return (
    <Panel>
      <ul className="divide-y divide-border">
        {rows.map((m) => (
          <li key={m.id} className="flex items-center justify-between p-3 text-sm">
            <span>{m.type} · {new Date(m.scheduledStart).toLocaleDateString()}</span>
            <StatusBadge tone={m.status === 'COMPLETED' ? 'success' : m.status === 'CANCELLED' ? 'neutral' : 'warning'} label={t(`maintenance.status_${m.status}`)} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function AvailabilityTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  // Availability is driven by scheduled maintenance windows (accessible to all
  // fleet roles); reservations/rentals appear in their own tabs.
  const q = useQuery({ queryKey: ['veh-avail', vehicleId], queryFn: () => maintenanceApi.list(undefined, 1, 50, vehicleId) });
  if (q.isLoading) return <Panel><TableSkeleton rows={3} cols={2} /></Panel>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const windows = (q.data?.data ?? []).filter((m) => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS');
  return (
    <Panel>
      {windows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">{t('fleet.status_AVAILABLE')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {windows.map((m) => (
            <li key={m.id} className="flex items-center gap-2 p-3 text-sm">
              <Wrench size={14} className="text-accent-600" aria-hidden />
              {new Date(m.scheduledStart).toLocaleString()} → {new Date(m.scheduledEnd).toLocaleString()} · {m.type}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function DamagesTab({ vehicleId, canEdit }: { vehicleId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['veh-damages', vehicleId], queryFn: () => fleetApi.listDamages(vehicleId) });
  const repair = useMutation({
    mutationFn: (damageId: string) => fleetApi.repairDamage(vehicleId, damageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['veh-damages', vehicleId] }),
  });
  if (q.isLoading) return <Panel><TableSkeleton rows={3} cols={2} /></Panel>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data?.data ?? [];
  if (rows.length === 0) return <Panel><p className="p-6 text-center text-sm text-muted">—</p></Panel>;
  return (
    <Panel>
      <ul className="divide-y divide-border">
        {rows.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 p-3">
            <DamageBadge damage={d} preExisting={d.repairedAt !== null} />
            {d.repairedAt ? (
              <span className="text-xs text-success">{t('maintenance.status_COMPLETED')}</span>
            ) : (
              canEdit && (
                <Button variant="secondary" className="min-h-[36px]" disabled={repair.isPending} onClick={() => repair.mutate(d.id)}>
                  {t('maintenance.complete')}
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ExpensesTab({ vehicleId }: { vehicleId: string }) {
  const q = useQuery({ queryKey: ['veh-expenses', vehicleId], queryFn: () => expensesApi.list(undefined, 1, 50, vehicleId) });
  const { t } = useTranslation();
  if (q.isLoading) return <Panel><TableSkeleton rows={3} cols={3} /></Panel>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const data = q.data?.data;
  const rows = data?.items ?? [];
  if (rows.length === 0) return <Panel><p className="p-6 text-center text-sm text-muted">—</p></Panel>;
  return (
    <Panel>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-border">
              <td className="px-3 py-2">{e.date.slice(0, 10)}</td>
              <td className="px-3 py-2">{t(`expenses.cat_${e.category}`)}</td>
              <td className="px-3 py-2 text-end font-mono"><Money value={e.amount} /></td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="px-3 py-2" colSpan={2}>{t('expenses.total')}</td>
            <td className="px-3 py-2 text-end font-mono"><Money value={data?.sum ?? '0.00'} /></td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

export function ProfitabilityTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['veh-profit', vehicleId], queryFn: () => reportsApi.profitability() });
  if (q.isLoading) return <Panel><TableSkeleton rows={2} cols={2} /></Panel>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const row = (q.data?.data ?? []).find((r) => r.vehicleId === vehicleId);
  if (!row) return <Panel><p className="p-6 text-center text-sm text-muted">—</p></Panel>;
  const cell = (label: string, value: string) => (
    <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-mono"><Money value={value} /></span>
    </div>
  );
  return (
    <Panel>
      {cell(t('reports.total'), row.revenue)}
      {cell(t('reports.expenses'), row.expenses)}
      {cell(t('reports.maintenance'), row.maintenance)}
      <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
        <span>{t('reports.profit')}</span>
        <span className="font-mono"><Money value={row.profit} /></span>
      </div>
    </Panel>
  );
}

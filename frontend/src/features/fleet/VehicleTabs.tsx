import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Wrench, CheckCircle2 } from 'lucide-react';
import type {
  VehicleAvailabilityEntry,
  VehicleDamageRow,
} from '@hosni/shared';
import {
  useVehicleAvailability,
  useVehicleRentals,
  useVehicleMaintenance,
  useVehicleDamages,
  useRepairDamage,
  useVehicleExpenses,
  useVehicleProfitability,
} from './hooks';
import { Money } from '../../components/ui/Money';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
const fmtRange = (a: string, b: string) => `${fmtDate(a)} → ${fmtDate(b)}`;

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">{children}</div>;
}

function Table({ header, rows }: { header: string[]; rows: React.ReactNode[][] }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-xs font-semibold uppercase text-muted">
            <tr>{header.map((h) => <th key={h} className="px-4 py-2 text-start">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((cell, j) => <td key={j} className="px-4 py-2">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Availability ──
export function AvailabilityTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const q = useVehicleAvailability(vehicleId);
  if (q.isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const data = q.data!.data;
  const kindLabel = (e: VehicleAvailabilityEntry) => t(`fleet.detail.kind_${e.kind}`);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {t('fleet.status')}: <span className="font-medium text-foreground">{t(`fleet.status_${data.status}`)}</span>
      </p>
      {data.entries.length === 0 ? (
        <EmptyState title={t('fleet.detail.noBookings')} body={t('fleet.detail.noBookingsBody')} />
      ) : (
        <Table
          header={[t('fleet.detail.kind'), t('fleet.detail.period'), t('fleet.status')]}
          rows={data.entries.map((e) => [kindLabel(e), fmtRange(e.startAt, e.endAt), e.status])}
        />
      )}
    </div>
  );
}

// ── Rentals ──
export function RentalsTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const q = useVehicleRentals(vehicleId);
  if (q.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data!.data;
  if (rows.length === 0) return <EmptyState title={t('fleet.detail.noRentals')} body={t('fleet.detail.noRentalsBody')} />;

  return (
    <Table
      header={[t('agreements.number'), t('fleet.detail.customer'), t('fleet.detail.period'), t('fleet.status')]}
      rows={rows.map((r) => [
        <Link key="n" to={`/rentals/${r.id}`} className="font-mono text-accent-600 hover:underline">#{r.agreementNumber}</Link>,
        r.customerName,
        fmtRange(r.startAt, r.endAt),
        t(`agreements.status_${r.status}`),
      ])}
    />
  );
}

// ── Maintenance ──
export function MaintenanceTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const q = useVehicleMaintenance(vehicleId);
  if (q.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data!.data;
  if (rows.length === 0) return <EmptyState title={t('fleet.detail.noMaintenance')} body={t('fleet.detail.noMaintenanceBody')} />;

  return (
    <Table
      header={[t('maintenance.type'), t('fleet.detail.period'), t('maintenance.status'), t('maintenance.cost')]}
      rows={rows.map((m) => [
        m.type,
        fmtRange(m.scheduledStart, m.scheduledEnd),
        t(`maintenance.status_${m.status}`),
        m.cost ? <Money key="c" value={m.cost} /> : '—',
      ])}
    />
  );
}

// ── Damages ──
function DamageRow({ vehicleId, d, canEdit }: { vehicleId: string; d: VehicleDamageRow; canEdit: boolean }) {
  const { t } = useTranslation();
  const repair = useRepairDamage(vehicleId);
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2">{d.panel.replace(/_/g, ' ')}</td>
      <td className="px-4 py-2">{t(`agreements.severity_${d.severity}`)}</td>
      <td className="px-4 py-2">{d.chargeAmount ? <Money value={d.chargeAmount} /> : '—'}</td>
      <td className="px-4 py-2">
        {d.repairedAt ? (
          <StatusBadge tone="success" label={`${t('fleet.detail.repaired')} ${fmtDate(d.repairedAt)}`} icon={<CheckCircle2 size={12} aria-hidden />} />
        ) : (
          <StatusBadge tone="warning" label={t('fleet.detail.active')} />
        )}
      </td>
      <td className="px-4 py-2 text-end">
        {canEdit && !d.repairedAt && (
          <Button variant="secondary" disabled={repair.isPending} onClick={() => repair.mutate(d.id)}>
            <Wrench size={14} aria-hidden />
            {t('fleet.detail.markRepaired')}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function DamagesTab({ vehicleId, canEdit }: { vehicleId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const q = useVehicleDamages(vehicleId);
  if (q.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data!.data;
  if (rows.length === 0) return <EmptyState title={t('fleet.detail.noDamages')} body={t('fleet.detail.noDamagesBody')} />;

  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('fleet.detail.panel')}</th>
              <th className="px-4 py-2 text-start">{t('fleet.detail.severity')}</th>
              <th className="px-4 py-2 text-start">{t('agreements.chargeAmount')}</th>
              <th className="px-4 py-2 text-start">{t('fleet.status')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <DamageRow key={d.id} vehicleId={vehicleId} d={d} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Expenses (manager only) ──
export function ExpensesTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const q = useVehicleExpenses(vehicleId);
  if (q.isLoading) return <TableSkeleton rows={5} cols={3} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data!.data;
  if (rows.length === 0) return <EmptyState title={t('fleet.detail.noExpenses')} body={t('fleet.detail.noExpensesBody')} />;

  return (
    <Table
      header={[t('expenses.date'), t('expenses.category'), t('expenses.description'), t('expenses.amount')]}
      rows={rows.map((e) => [
        fmtDate(e.date),
        t(`expenses.cat_${e.category}`),
        e.description ?? '—',
        <Money key="a" value={e.amount} />,
      ])}
    />
  );
}

// ── Profitability (manager only) ──
export function ProfitabilityTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const q = useVehicleProfitability(vehicleId);
  if (q.isLoading) return <TableSkeleton rows={2} cols={2} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const d = q.data!.data;
  const cell = (label: string, value: string, strong = false) => (
    <div className="rounded-md border border-border bg-surface p-4 shadow-card">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className={'mt-1 font-mono ' + (strong ? 'text-lg font-semibold text-foreground' : 'text-foreground')}>
        <Money value={value} />
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cell(t('reports.total'), d.revenue)}
      {cell(t('reports.expenses'), d.expenses)}
      {cell(t('reports.maintenance'), d.maintenance)}
      {cell(t('reports.profit'), d.profit, true)}
    </div>
  );
}

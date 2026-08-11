import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { reportsApi } from './api';
import { Button } from '../../components/ui/Button';
import { Money } from '../../components/ui/Money';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, TableSkeleton } from '../../components/ui/states';
import { downloadCsv } from '../../lib/csv';

type Tab = 'revenue' | 'profitability' | 'outstanding' | 'overdue' | 'utilization';

export default function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('revenue');
  const tabs: Tab[] = ['revenue', 'profitability', 'outstanding', 'overdue', 'utilization'];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('reports.title')}</h1>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-current={tab === k ? 'page' : undefined}
            className={'min-h-[44px] px-3 text-sm font-medium ' + (tab === k ? 'border-b-2 border-accent text-foreground' : 'text-muted')}
          >
            {t(`reports.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'revenue' && <RevenueTab />}
      {tab === 'profitability' && <ProfitabilityTab />}
      {tab === 'outstanding' && <OutstandingTab />}
      {tab === 'overdue' && <OverdueTab />}
      {tab === 'utilization' && <UtilizationTab />}
    </div>
  );
}

function UtilizationTab() {
  const { t } = useTranslation();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  const query = useQuery({
    queryKey: ['report-utilization'],
    queryFn: () => reportsApi.utilization(from.toISOString(), to.toISOString()),
  });

  if (query.isLoading) return <TableSkeleton rows={6} cols={4} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const rows = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* The definition is stated on the screen, per §5.12. */}
      <p className="text-xs text-muted">{t('reports.utilizationNote')}</p>
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              'utilization.csv',
              ['vehicle', 'rentedDays', 'availableDays', 'utilizationPct'],
              rows.map((r) => [r.plateNumber, String(r.rentedDays), String(r.availableDays), String(r.utilizationPct)]),
            )
          }
        >
          <Download size={16} aria-hidden />
          {t('reports.export')}
        </Button>
      </div>
      <Table
        header={[t('reports.vehicle'), t('reports.rentedDays'), t('reports.availableDays'), t('reports.utilizationPct')]}
        rows={rows.map((r) => [
          <span key="v" className="font-mono">{r.plateNumber}</span>,
          r.rentedDays,
          r.availableDays,
          <span key="p" className="font-semibold">{r.utilizationPct}%</span>,
        ])}
      />
    </div>
  );
}

function RevenueTab() {
  const { t } = useTranslation();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  const query = useQuery({ queryKey: ['report-revenue'], queryFn: () => reportsApi.revenue(from.toISOString(), to.toISOString()) });

  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const data = query.data?.data;
  const points = data?.points ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{t('reports.total')}: {data && <Money value={data.total} />}</span>
          <Button variant="secondary" onClick={() => downloadCsv('revenue.csv', ['period', 'revenue'], points.map((p) => [p.period, p.revenue]))}>
            <Download size={16} aria-hidden />
            {t('reports.export')}
          </Button>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={points.map((p) => ({ period: p.period.slice(5), revenue: Number(p.revenue) }))}>
              <XAxis dataKey="period" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="revenue" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* The table is the accessible form of the chart, not an afterthought. */}
      <Table header={[t('reports.period'), t('reports.total')]} rows={points.map((p) => [p.period, <Money key={p.period} value={p.revenue} />])} />
    </div>
  );
}

function ProfitabilityTab() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['report-profit'], queryFn: () => reportsApi.profitability() });
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const rows = query.data?.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => downloadCsv('profitability.csv', ['vehicle', 'revenue', 'expenses', 'maintenance', 'profit'], rows.map((r) => [r.plateNumber, r.revenue, r.expenses, r.maintenance, r.profit]))}>
          <Download size={16} aria-hidden />
          {t('reports.export')}
        </Button>
      </div>
      <Table
        header={[t('reports.vehicle'), t('reports.total'), t('reports.expenses'), t('reports.maintenance'), t('reports.profit')]}
        rows={rows.map((r) => [
          <span key="v" className="font-mono">{r.plateNumber}</span>,
          <Money key="r" value={r.revenue} />,
          <Money key="e" value={r.expenses} />,
          <Money key="m" value={r.maintenance} />,
          <Money key="p" value={r.profit} />,
        ])}
      />
    </div>
  );
}

function OutstandingTab() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['report-outstanding'], queryFn: () => reportsApi.outstanding() });
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const rows = query.data?.data ?? [];
  return (
    <Table
      header={[t('reports.customer'), t('reports.balance'), t('reports.age'), t('reports.bucket')]}
      rows={rows.map((r) => [r.customerName, <Money key="b" value={r.balance} />, r.ageDays, <StatusBadge key="k" tone={r.bucket === '90+' ? 'error' : r.bucket === '0-30' ? 'success' : 'warning'} label={r.bucket} />])}
    />
  );
}

function OverdueTab() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['report-overdue'], queryFn: () => reportsApi.overdue() });
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const rows = query.data?.data ?? [];
  return (
    <Table
      header={[t('reports.customer'), t('reports.vehicle'), t('reports.dueAt'), t('reports.overdueDays')]}
      rows={rows.map((r) => [r.customerName, <span key="v" className="font-mono">{r.vehiclePlate}</span>, new Date(r.dueAt).toLocaleDateString(), r.overdueDays])}
    />
  );
}

function Table({ header, rows }: { header: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-surface-alt text-xs font-semibold uppercase text-muted">
          <tr>{header.map((h) => <th key={h} className="px-4 py-2 text-start">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="px-4 py-6 text-center text-muted" colSpan={header.length}>—</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((cell, j) => <td key={j} className="px-4 py-2">{cell}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from './api';
import { TextField } from '../../components/ui/TextField';
import { Money } from '../../components/ui/Money';
import { ErrorState } from '../../components/ui/states';

export default function CashSummaryPage() {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const summary = useQuery({
    queryKey: ['cash-summary', date],
    queryFn: () => invoicesApi.cashSummary(new Date(date).toISOString()),
  });
  const data = summary.data?.data;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('invoices.cashSummary')}</h1>
      <div className="mb-4 max-w-xs">
        <TextField label={t('common.search')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {summary.isError ? (
        <ErrorState onRetry={() => summary.refetch()} />
      ) : data ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-primary p-4 text-center text-white">
            <div className="text-sm opacity-80">{t('invoices.total')}</div>
            <div className="text-2xl font-bold"><Money value={data.total} /></div>
          </div>
          <Section title={t('invoices.byMethod')} rows={data.byMethod} labeler={(k) => t(`invoices.method_${k}`)} />
          <Section title={t('invoices.byUser')} rows={data.byUser} />
        </div>
      ) : (
        <p className="text-sm text-muted">{t('common.loading')}</p>
      )}
    </div>
  );
}

function Section({ title, rows, labeler }: { title: string; rows: Record<string, string>; labeler?: (k: string) => string }) {
  const entries = Object.entries(rows);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-surface-alt px-4 py-2 text-xs font-semibold uppercase text-muted">{title}</div>
      {entries.length === 0 ? (
        <p className="p-4 text-sm text-muted">—</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-b border-border">
                <td className="px-4 py-2">{labeler ? labeler(k) : k}</td>
                <td className="px-4 py-2 text-end font-mono"><Money value={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

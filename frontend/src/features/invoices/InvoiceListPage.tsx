import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { INVOICE_STATUSES } from '@hosni/shared';
import { useInvoices } from './hooks';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { Money } from '../../components/ui/Money';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';
import { useActiveBranch } from '../../app/ActiveBranchContext';

const PAGE_SIZE = 20;

export default function InvoiceListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1');
  const { branchId: activeBranch } = useActiveBranch();

  const query = useMemo(
    () => ({ status: status || undefined, branchId: activeBranch || undefined, page, pageSize: PAGE_SIZE }),
    [status, activeBranch, page],
  );
  const invoicesQuery = useInvoices(query);
  const rows = invoicesQuery.data?.data ?? [];
  const total = invoicesQuery.data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('invoices.title')}</h1>
          <p className="text-sm text-muted">{t('invoices.subtitle')}</p>
        </div>
        <Link to="/invoices/cash-summary">
          <Button variant="secondary">{t('invoices.cashSummary')}</Button>
        </Link>
      </div>

      <div className="mb-4 max-w-xs">
        <SelectField
          label={t('fleet.status')}
          placeholder={t('fleet.allStatuses')}
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          options={INVOICE_STATUSES.map((s) => ({ value: s, label: t(`invoices.status_${s}`) }))}
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {invoicesQuery.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : invoicesQuery.isError ? (
          <ErrorState onRetry={() => invoicesQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={t('invoices.empty')} body={t('invoices.emptyBody')} />
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-surface-alt text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-4 py-3 text-start">{t('invoices.number')}</th>
                <th className="px-4 py-3 text-end">{t('invoices.total')}</th>
                <th className="px-4 py-3 text-end">{t('invoices.balance')}</th>
                <th className="px-4 py-3 text-start">{t('fleet.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="h-row cursor-pointer border-t border-border text-sm hover:bg-surface-alt"
                  onClick={() => navigate(`/invoices/${r.id}`)}
                >
                  <td className="px-4 py-2 font-mono font-medium">#{r.invoiceNumber}</td>
                  <td className="px-4 py-2 text-end"><Money value={r.total} /></td>
                  <td className="px-4 py-2 text-end"><Money value={r.balance} /></td>
                  <td className="px-4 py-2"><InvoiceStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {t('common.page')} {page} {t('common.of')} {pageCount}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
              ‹
            </Button>
            <Button variant="secondary" disabled={page >= pageCount} onClick={() => setParam('page', String(page + 1))}>
              ›
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

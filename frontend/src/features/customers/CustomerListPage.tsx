import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Ban, AlertTriangle } from 'lucide-react';
import { useCustomers } from './hooks';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';

const PAGE_SIZE = 20;

export default function CustomerListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const blocked = params.get('blocked') === '1';
  const page = Number(params.get('page') ?? '1');

  const query = useMemo(
    () => ({ q: q || undefined, blocked: blocked ? 'true' : undefined, page, pageSize: PAGE_SIZE }),
    [q, blocked, page],
  );
  const customersQuery = useCustomers(query);
  const rows = customersQuery.data?.data ?? [];
  const total = customersQuery.data?.meta?.total ?? 0;
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
          <h1 className="text-xl font-bold text-foreground">{t('customers.title')}</h1>
          <p className="text-sm text-muted">{t('customers.subtitle')}</p>
        </div>
        <Button variant="accent" onClick={() => navigate('/customers/new')}>
          <Plus size={18} aria-hidden />
          {t('customers.add')}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{t('common.search')}</span>
          <input
            type="search"
            defaultValue={q}
            placeholder={t('customers.searchPlaceholder')}
            onChange={(e) => setParam('q', e.target.value)}
            className="min-h-[44px] rounded-md border border-border bg-surface px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          />
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setParam('blocked', e.target.checked ? '1' : '')}
            className="h-5 w-5 rounded border-border"
          />
          <span className="text-sm text-foreground">{t('customers.blockedOnly')}</span>
        </label>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {customersQuery.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : customersQuery.isError ? (
          <ErrorState onRetry={() => customersQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('customers.empty')}
            body={t('customers.emptyBody')}
            action={
              <Button variant="accent" onClick={() => navigate('/customers/new')}>
                <Plus size={18} aria-hidden />
                {t('customers.add')}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id}>
                <Link to={`/customers/${c.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface-alt">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{c.fullName}</span>
                    <p className="font-mono text-xs text-muted">{c.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.licenceExpired && (
                      <StatusBadge tone="warning" label={t('customers.licenceExpired')} icon={<AlertTriangle size={12} aria-hidden />} />
                    )}
                    {c.isBlocked && (
                      <StatusBadge tone="error" label={t('customers.blocked')} icon={<Ban size={12} aria-hidden />} />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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

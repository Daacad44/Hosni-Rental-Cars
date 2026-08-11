import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { AGREEMENT_STATUSES } from '@hosni/shared';
import { useAgreements } from './hooks';
import { AgreementStatusBadge } from './AgreementStatusBadge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';
import { useActiveBranch } from '../../app/ActiveBranchContext';

const PAGE_SIZE = 20;

export default function AgreementListPage() {
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
  const agreementsQuery = useAgreements(query);
  const rows = agreementsQuery.data?.data ?? [];
  const total = agreementsQuery.data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('agreements.title')}</h1>
          <p className="text-sm text-muted">{t('agreements.subtitle')}</p>
        </div>
        <Button variant="accent" onClick={() => navigate('/rentals/checkout')}>
          <Plus size={18} aria-hidden />
          {t('agreements.checkout')}
        </Button>
      </div>

      <div className="mb-4 max-w-xs">
        <SelectField
          label={t('fleet.status')}
          placeholder={t('fleet.allStatuses')}
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          options={AGREEMENT_STATUSES.map((s) => ({ value: s, label: t(`agreements.status_${s}`) }))}
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {agreementsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : agreementsQuery.isError ? (
          <ErrorState onRetry={() => agreementsQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('agreements.empty')}
            body={t('agreements.emptyBody')}
            action={
              <Button variant="accent" onClick={() => navigate('/rentals/checkout')}>
                <Plus size={18} aria-hidden />
                {t('agreements.checkout')}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const overdue = r.status === 'OVERDUE';
              return (
                <li key={r.id}>
                  <Link
                    to={`/rentals/${r.id}`}
                    className={
                      'flex items-center justify-between gap-3 p-4 hover:bg-surface-alt ' +
                      (overdue ? 'border-s-4 border-error' : '')
                    }
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">
                        #{r.agreementNumber} · {r.customerName}
                      </span>
                      <p className="text-xs text-muted">
                        <span className="font-mono">{r.vehiclePlate}</span> · {fmt(r.startAt)} → {fmt(r.endAt)}
                      </p>
                    </div>
                    <AgreementStatusBadge status={r.status} />
                  </Link>
                </li>
              );
            })}
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

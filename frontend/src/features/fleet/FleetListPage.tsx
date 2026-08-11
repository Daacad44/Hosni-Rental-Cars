import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, FileWarning } from 'lucide-react';
import { VEHICLE_STATUSES } from '@hosni/shared';
import { useVehicles } from './hooks';
import { useBranches } from '../branches/hooks';
import { VehicleStatusBadge } from './VehicleStatusBadge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';
import { useActiveBranch } from '../../app/ActiveBranchContext';

const PAGE_SIZE = 20;

export default function FleetListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const branches = useBranches();

  // Filters live in the URL so a view can be linked and shared.
  const { branchId: activeBranch } = useActiveBranch();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  // A page-level branch filter wins; otherwise the topbar branch switcher applies.
  const branchId = params.get('branchId') ?? '';
  const effectiveBranch = branchId || activeBranch;
  const docsExpiring = params.get('docsExpiring') === '1';
  const page = Number(params.get('page') ?? '1');

  const query = useMemo(
    () => ({
      q: q || undefined,
      status: status || undefined,
      branchId: effectiveBranch || undefined,
      docsExpiringDays: docsExpiring ? 30 : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [q, status, effectiveBranch, docsExpiring, page],
  );

  const vehiclesQuery = useVehicles(query);
  const rows = vehiclesQuery.data?.data ?? [];
  const total = vehiclesQuery.data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Any filter change resets to the first page; paging itself does not.
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('fleet.title')}</h1>
          <p className="text-sm text-muted">{t('fleet.subtitle')}</p>
        </div>
        <Button variant="accent" onClick={() => navigate('/fleet/new')}>
          <Plus size={18} aria-hidden />
          {t('fleet.add')}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{t('common.search')}</span>
          <input
            type="search"
            defaultValue={q}
            placeholder={t('fleet.searchPlaceholder')}
            onChange={(e) => setParam('q', e.target.value)}
            className="min-h-[44px] rounded-md border border-border bg-surface px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          />
        </label>
        <SelectField
          label={t('fleet.status')}
          placeholder={t('fleet.allStatuses')}
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          options={VEHICLE_STATUSES.map((s) => ({ value: s, label: t(`fleet.status_${s}`) }))}
        />
        <SelectField
          label={t('fleet.branch')}
          placeholder={t('fleet.allBranches')}
          value={branchId}
          onChange={(e) => setParam('branchId', e.target.value)}
          options={(branches.data?.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
        />
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={docsExpiring}
            onChange={(e) => setParam('docsExpiring', e.target.checked ? '1' : '')}
            className="h-5 w-5 rounded border-border"
          />
          <span className="text-sm text-foreground">{t('fleet.docsExpiring')}</span>
        </label>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {vehiclesQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : vehiclesQuery.isError ? (
          <ErrorState onRetry={() => vehiclesQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('fleet.empty')}
            body={t('fleet.emptyBody')}
            action={
              <Button variant="accent" onClick={() => navigate('/fleet/new')}>
                <Plus size={18} aria-hidden />
                {t('fleet.add')}
              </Button>
            }
          />
        ) : (
          <>
            <table className="hidden w-full border-collapse md:table">
              <thead className="sticky top-0 bg-surface-alt">
                <tr className="text-xs font-semibold uppercase text-muted">
                  <th className="px-4 py-3 text-start">{t('fleet.plate')}</th>
                  <th className="px-4 py-3 text-start">{t('fleet.vehicle')}</th>
                  <th className="px-4 py-3 text-start">{t('fleet.category')}</th>
                  <th className="px-4 py-3 text-start">{t('fleet.branch')}</th>
                  <th className="px-4 py-3 text-end">{t('fleet.odometer')}</th>
                  <th className="px-4 py-3 text-start">{t('fleet.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr
                    key={v.id}
                    className="h-row cursor-pointer border-t border-border text-sm hover:bg-surface-alt"
                    onClick={() => navigate(`/fleet/${v.id}`)}
                  >
                    <td className="px-4 py-2 font-mono font-medium text-foreground">{v.plateNumber}</td>
                    <td className="px-4 py-2">
                      {v.make} {v.model} · {v.year}
                    </td>
                    <td className="px-4 py-2">{v.category}</td>
                    <td className="px-4 py-2">{v.branchName}</td>
                    <td className="px-4 py-2 text-end font-mono tabular">
                      {v.odometer.toLocaleString()} {t('fleet.km')}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <VehicleStatusBadge status={v.status} />
                        {v.hasExpiringDocs && (
                          <span
                            className="inline-flex items-center gap-1 text-accent-600"
                            title={t('fleet.docsExpiringBadge')}
                          >
                            <FileWarning size={14} aria-hidden />
                            <span className="sr-only">{t('fleet.docsExpiringBadge')}</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((v) => (
                <li key={v.id}>
                  <Link to={`/fleet/${v.id}`} className="flex flex-col gap-1 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-foreground">{v.plateNumber}</span>
                      <VehicleStatusBadge status={v.status} />
                    </div>
                    <span className="text-sm">
                      {v.make} {v.model} · {v.year}
                    </span>
                    <span className="text-xs text-muted">
                      {v.category} · {v.branchName} · {v.odometer.toLocaleString()} {t('fleet.km')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {t('common.page')} {page} {t('common.of')} {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
            >
              ‹
            </Button>
            <Button
              variant="secondary"
              disabled={page >= pageCount}
              onClick={() => setParam('page', String(page + 1))}
            >
              ›
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { RESERVATION_STATUSES } from '@hosni/shared';
import { useReservations } from './hooks';
import { ReservationStatusBadge } from './ReservationStatusBadge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { Money } from '../../components/ui/Money';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';

const PAGE_SIZE = 20;

export default function ReservationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1');

  const query = useMemo(
    () => ({ status: status || undefined, page, pageSize: PAGE_SIZE }),
    [status, page],
  );
  const reservationsQuery = useReservations(query);
  const rows = reservationsQuery.data?.data ?? [];
  const total = reservationsQuery.data?.meta?.total ?? 0;
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
          <h1 className="text-xl font-bold text-foreground">{t('reservations.title')}</h1>
          <p className="text-sm text-muted">{t('reservations.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/reservations/calendar')}>
            {t('reservations.calendar')}
          </Button>
          <Button variant="accent" onClick={() => navigate('/reservations/new')}>
            <Plus size={18} aria-hidden />
            {t('reservations.add')}
          </Button>
        </div>
      </div>

      <div className="mb-4 max-w-xs">
        <SelectField
          label={t('fleet.status')}
          placeholder={t('fleet.allStatuses')}
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          options={RESERVATION_STATUSES.map((s) => ({ value: s, label: t(`reservations.status_${s}`) }))}
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {reservationsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : reservationsQuery.isError ? (
          <ErrorState onRetry={() => reservationsQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('reservations.empty')}
            body={t('reservations.emptyBody')}
            action={
              <Button variant="accent" onClick={() => navigate('/reservations/new')}>
                <Plus size={18} aria-hidden />
                {t('reservations.add')}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`/reservations/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface-alt">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{r.customerName}</span>
                    <p className="text-xs text-muted">
                      {r.category}
                      {r.vehiclePlate && <span className="ms-1 font-mono">· {r.vehiclePlate}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {fmt(r.startAt)} → {fmt(r.endAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ReservationStatusBadge status={r.status} />
                    <Money value={r.quotedTotal} />
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

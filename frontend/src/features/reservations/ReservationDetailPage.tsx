import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReservation, useReservationMutation } from './hooks';
import { ReservationStatusBadge } from './ReservationStatusBadge';
import { Button } from '../../components/ui/Button';
import { BreakdownTable } from '../../components/ui/BreakdownTable';
import { ErrorState } from '../../components/ui/states';
import { ApiError } from '../../lib/apiClient';

export default function ReservationDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const reservationQuery = useReservation(id);
  const mutation = useReservationMutation(id);

  if (reservationQuery.isError) return <ErrorState onRetry={() => reservationQuery.refetch()} />;
  if (!reservationQuery.data) return <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>;
  const r = reservationQuery.data.data;

  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const confirmError =
    mutation.confirm.error instanceof ApiError && mutation.confirm.error.code === 'OVERLAPPING_RESERVATION'
      ? t('reservations.overlapError')
      : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{r.customerName}</h1>
          <p className="text-sm text-muted">
            {r.category}
            {r.vehiclePlate && <span className="ms-1 font-mono">· {r.vehiclePlate}</span>}
          </p>
        </div>
        <ReservationStatusBadge status={r.status} />
      </div>

      {confirmError && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {confirmError}
        </div>
      )}

      <dl className="mb-4 grid grid-cols-2 gap-4 rounded-md border border-border bg-surface p-4 shadow-card">
        <div>
          <dt className="text-xs uppercase text-muted">{t('reservations.startAt')}</dt>
          <dd className="text-sm">{fmt(r.startAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted">{t('reservations.endAt')}</dt>
          <dd className="text-sm">{fmt(r.endAt)}</dd>
        </div>
      </dl>

      <BreakdownTable breakdown={r.breakdown} />

      <div className="mt-4 flex justify-end gap-2">
        {r.status === 'PENDING' && r.vehicleId && (
          <Button variant="accent" disabled={mutation.confirm.isPending} onClick={() => mutation.confirm.mutate(undefined)}>
            {t('reservations.confirm')}
          </Button>
        )}
        {(r.status === 'PENDING' || r.status === 'CONFIRMED') && (
          <Button variant="danger" disabled={mutation.cancel.isPending} onClick={() => mutation.cancel.mutate()}>
            {t('reservations.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

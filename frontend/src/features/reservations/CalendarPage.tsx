import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useReservations } from './hooks';
import { Button } from '../../components/ui/Button';
import { ErrorState, TableSkeleton } from '../../components/ui/states';

const DAYS = 14;

/**
 * Availability calendar: vehicles (via their reservations) down the left, days
 * across the top, a bar for each reservation. A compact operational view.
 */
export default function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset * DAYS);
    return d;
  }, [offset]);
  const rangeEnd = useMemo(() => new Date(rangeStart.getTime() + DAYS * 86400000), [rangeStart]);

  const query = useReservations({
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
    page: 1,
    pageSize: 100,
  });
  const rows = (query.data?.data ?? []).filter((r) => r.status === 'CONFIRMED' || r.status === 'CONVERTED');

  const days = Array.from({ length: DAYS }, (_, i) => new Date(rangeStart.getTime() + i * 86400000));

  const barStyle = (startIso: string, endIso: string) => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const from = Math.max(start, rangeStart.getTime());
    const to = Math.min(end, rangeEnd.getTime());
    const left = ((from - rangeStart.getTime()) / (DAYS * 86400000)) * 100;
    const width = Math.max(2, ((to - from) / (DAYS * 86400000)) * 100);
    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('reservations.calendar')}</h1>
          <p className="text-sm text-muted">
            {rangeStart.toLocaleDateString()} – {rangeEnd.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOffset((o) => o - 1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="secondary" onClick={() => setOffset(0)}>
            {t('nav.dashboard')}
          </Button>
          <Button variant="secondary" onClick={() => setOffset((o) => o + 1)} aria-label="Next">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {query.isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="flex border-b border-border bg-surface-alt text-xs text-muted">
                <div className="w-40 shrink-0 px-3 py-2 font-semibold">{t('reservations.vehicle')}</div>
                <div className="relative flex-1">
                  <div className="flex">
                    {days.map((d) => (
                      <div key={d.toISOString()} className="flex-1 border-s border-border px-1 py-2 text-center">
                        {d.getDate()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">{t('reservations.empty')}</p>
              ) : (
                rows.map((r) => (
                  <div key={r.id} className="flex items-center border-b border-border">
                    <div className="w-40 shrink-0 px-3 py-2 text-sm">
                      <span className="font-mono">{r.vehiclePlate ?? '—'}</span>
                    </div>
                    <div className="relative h-8 flex-1">
                      <button
                        onClick={() => navigate(`/reservations/${r.id}`)}
                        className="absolute top-1 h-6 rounded-sm bg-primary text-xs text-white"
                        style={barStyle(r.startAt, r.endAt)}
                        title={r.customerName}
                      >
                        <span className="truncate px-1">{r.customerName}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, Receipt } from 'lucide-react';
import { useAgreement } from './hooks';
import { AgreementStatusBadge } from './AgreementStatusBadge';
import { DamageList } from './DamageList';
import { Button } from '../../components/ui/Button';
import { Money } from '../../components/ui/Money';
import { ErrorState } from '../../components/ui/states';

export default function AgreementDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const agreementQuery = useAgreement(id);

  if (agreementQuery.isError) return <ErrorState onRetry={() => agreementQuery.refetch()} />;
  if (!agreementQuery.data) return <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>;
  const a = agreementQuery.data.data;
  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const open = a.status === 'OPEN' || a.status === 'OVERDUE';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              {t('agreements.number')} #{a.agreementNumber}
            </h1>
            <AgreementStatusBadge status={a.status} />
          </div>
          <p className="text-sm text-muted">
            {a.customerName} · <span className="font-mono">{a.vehiclePlate}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {open && (
            <Button variant="accent" onClick={() => navigate(`/rentals/${id}/checkin`)}>
              <LogIn size={16} aria-hidden />
              {t('agreements.checkin')}
            </Button>
          )}
          {a.invoice && (
            <Button variant="secondary" onClick={() => navigate(`/invoices/${a.invoice!.id}`)}>
              <Receipt size={16} aria-hidden />
              {t('invoices.number')}
            </Button>
          )}
        </div>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-4 rounded-md border border-border bg-surface p-4 shadow-card sm:grid-cols-3">
        <Detail label={t('reservations.startAt')} value={fmt(a.startAt)} />
        <Detail label={t('reservations.endAt')} value={fmt(a.endAt)} />
        <Detail label={t('agreements.withDriver')} value={a.withDriver ? '✓' : '—'} />
        <Detail label={`${t('agreements.odometer')} (out)`} value={`${a.checkoutOdometer.toLocaleString()} km`} mono />
        <Detail label={`${t('agreements.odometer')} (in)`} value={a.checkinOdometer !== null ? `${a.checkinOdometer.toLocaleString()} km` : '—'} mono />
        <Detail label={t('agreements.fuel')} value={`${a.checkoutFuel}/8${a.checkinFuel !== null ? ` → ${a.checkinFuel}/8` : ''}`} mono />
      </dl>

      <div className="mb-4 rounded-md border border-border bg-surface p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{t('agreements.damage')}</h2>
        <DamageList preExisting={a.preExistingDamages} neu={a.newDamages} />
      </div>

      {a.invoice && (
        <Link to={`/invoices/${a.invoice.id}`} className="flex items-center justify-between rounded-md border border-border bg-surface p-4 shadow-card hover:bg-surface-alt">
          <span className="text-sm font-medium">{t('invoices.balance')}</span>
          <span className="font-mono font-semibold">
            <Money value={a.invoice.balance} />
          </span>
        </Link>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className={'mt-0.5 text-sm text-foreground' + (mono ? ' font-mono tabular' : '')}>{value}</dd>
    </div>
  );
}

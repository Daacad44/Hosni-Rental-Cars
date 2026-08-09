import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { CreateReservationRequest } from '@hosni/shared';
import { reservationsApi } from './api';
import { useCreateReservation } from './hooks';
import { useCustomers } from '../customers/hooks';
import { useAuth } from '../auth/hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { BreakdownTable } from '../../components/ui/BreakdownTable';
import { ApiError } from '../../lib/apiClient';

function toIso(local: string): string {
  return new Date(local).toISOString();
}

export default function NewReservationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useAuth();
  const isManager = me ? ['OWNER', 'MANAGER'].includes(me.role) : false;

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [category, setCategory] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [confirmNow, setConfirmNow] = useState(true);
  const [overrideLicence, setOverrideLicence] = useState(false);

  const customers = useCustomers({ q: customerSearch || undefined, page: 1, pageSize: 8 });
  const create = useCreateReservation();

  const datesValid = Boolean(startLocal && endLocal && new Date(endLocal) > new Date(startLocal));

  const availability = useQuery({
    queryKey: ['availability', startLocal, endLocal, category],
    queryFn: () => reservationsApi.availableVehicles(toIso(startLocal), toIso(endLocal), category || undefined),
    enabled: datesValid,
  });

  const quote = useQuery({
    queryKey: ['res-quote', vehicleId, startLocal, endLocal],
    queryFn: () => reservationsApi.quote({ vehicleId, startAt: toIso(startLocal), endAt: toIso(endLocal) }),
    enabled: Boolean(vehicleId) && datesValid,
  });

  const errorMessage = (() => {
    if (!(create.error instanceof ApiError)) return null;
    switch (create.error.code) {
      case 'CUSTOMER_BLOCKED':
        return t('reservations.blockedError');
      case 'LICENCE_EXPIRED':
        return t('reservations.licenceError');
      case 'OVERLAPPING_RESERVATION':
        return t('reservations.overlapError');
      default:
        return create.error.message;
    }
  })();

  const canSubmit = customerId && datesValid && category;

  const submit = () => {
    const body: CreateReservationRequest = {
      customerId,
      category,
      vehicleId: vehicleId || null,
      startAt: toIso(startLocal),
      endAt: toIso(endLocal),
      confirm: confirmNow && Boolean(vehicleId),
      overrideLicence: overrideLicence || undefined,
    };
    create.mutate(body, { onSuccess: (res) => navigate(`/reservations/${res.data.id}`) });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('reservations.add')}</h1>

      {errorMessage && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {errorMessage}
        </div>
      )}

      <section className="mb-6 rounded-md border border-border bg-surface p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{t('reservations.customer')}</h2>
        {customerId ? (
          <div className="flex items-center justify-between">
            <span className="font-medium">{customerName}</span>
            <Button variant="ghost" onClick={() => { setCustomerId(''); setCustomerName(''); }}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-md border border-border px-3">
              <Search size={16} className="text-muted" aria-hidden />
              <input
                className="min-h-[44px] flex-1 bg-transparent text-base focus:outline-none"
                placeholder={t('reservations.selectCustomer')}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </label>
            {customerSearch && (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {(customers.data?.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-start hover:bg-surface-alt"
                      onClick={() => { setCustomerId(c.id); setCustomerName(c.fullName); }}
                    >
                      <span>{c.fullName}</span>
                      <span className="font-mono text-xs text-muted">{c.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="mb-6 grid gap-4 rounded-md border border-border bg-surface p-4 shadow-card sm:grid-cols-2">
        <TextField label={t('reservations.startAt')} type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
        <TextField label={t('reservations.endAt')} type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
        <TextField label={t('reservations.category')} value={category} onChange={(e) => setCategory(e.target.value)} />
      </section>

      {datesValid && (
        <section className="mb-6 rounded-md border border-border bg-surface p-4 shadow-card">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t('reservations.availableVehicles')}</h2>
          {availability.isLoading ? (
            <p className="text-sm text-muted">{t('common.loading')}</p>
          ) : (availability.data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t('reservations.noneAvailable')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(availability.data?.data ?? []).map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setVehicleId(v.id); if (!category) setCategory(v.category); }}
                  className={
                    'rounded-md border px-3 py-2 text-sm ' +
                    (vehicleId === v.id ? 'border-accent bg-primary-100' : 'border-border hover:bg-surface-alt')
                  }
                >
                  <span className="font-mono font-medium">{v.plateNumber}</span> · {v.make} {v.model}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {vehicleId && quote.data && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t('reservations.quote')}</h2>
          <BreakdownTable breakdown={quote.data.data} />
        </section>
      )}

      <div className="mb-6 flex flex-col gap-2">
        {vehicleId && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmNow} onChange={(e) => setConfirmNow(e.target.checked)} className="h-5 w-5" />
            {t('reservations.confirmNow')}
          </label>
        )}
        {isManager && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overrideLicence} onChange={(e) => setOverrideLicence(e.target.checked)} className="h-5 w-5" />
            {t('reservations.overrideLicence')}
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/reservations')}>
          {t('common.cancel')}
        </Button>
        <Button variant="accent" disabled={!canSubmit || create.isPending} onClick={submit}>
          {t('reservations.create')}
        </Button>
      </div>
    </div>
  );
}

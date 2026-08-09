import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { CheckoutRequest, PaymentMethod } from '@hosni/shared';
import { PAYMENT_METHODS } from '@hosni/shared';
import { useCheckout } from './hooks';
import { InspectionFields, emptyInspection, type InspectionValue } from './InspectionFields';
import { reservationsApi } from '../reservations/api';
import { useCustomers } from '../customers/hooks';
import { useAuth } from '../auth/hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Modal } from '../../components/ui/Modal';
import { BreakdownTable } from '../../components/ui/BreakdownTable';
import { ApiError } from '../../lib/apiClient';

const DRAFT_KEY = 'hosni.checkout.draft';
const STEPS = ['customer', 'vehicle', 'inspection', 'deposit', 'review'] as const;
type Step = (typeof STEPS)[number];

interface Draft {
  customerId: string;
  customerName: string;
  vehicleId: string;
  startLocal: string;
  endLocal: string;
  withDriver: boolean;
  depositMethod: PaymentMethod;
  overrideLicence: boolean;
  inspection: InspectionValue;
  signatureKey?: string;
}

const toIso = (local: string) => new Date(local).toISOString();

export default function CheckoutWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: me } = useAuth();
  const canCharge = me ? ['OWNER', 'MANAGER'].includes(me.role) : false;
  const checkout = useCheckout();

  const [step, setStep] = useState<Step>('customer');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [draft, setDraft] = useState<Draft>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as Draft;
      } catch {
        /* ignore corrupt draft */
      }
    }
    return {
      customerId: '',
      customerName: '',
      vehicleId: params.get('vehicleId') ?? '',
      startLocal: '',
      endLocal: '',
      withDriver: false,
      depositMethod: 'CASH',
      overrideLicence: false,
      inspection: emptyInspection(),
    };
  });

  // Auto-save: a browser refresh at any step loses nothing.
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const customers = useCustomers({ q: customerSearch || undefined, page: 1, pageSize: 8 });

  const datesValid = Boolean(draft.startLocal && draft.endLocal && new Date(draft.endLocal) > new Date(draft.startLocal));

  const availability = useQuery({
    queryKey: ['checkout-avail', draft.startLocal, draft.endLocal],
    queryFn: () => reservationsApi.availableVehicles(toIso(draft.startLocal), toIso(draft.endLocal)),
    enabled: datesValid,
  });

  const quote = useQuery({
    queryKey: ['checkout-quote', draft.vehicleId, draft.startLocal, draft.endLocal],
    queryFn: () => reservationsApi.quote({ vehicleId: draft.vehicleId, startAt: toIso(draft.startLocal), endAt: toIso(draft.endLocal) }),
    enabled: Boolean(draft.vehicleId) && datesValid,
  });

  const stepValid = useMemo<Record<Step, boolean>>(
    () => ({
      customer: Boolean(draft.customerId),
      vehicle: Boolean(draft.vehicleId) && datesValid,
      inspection: draft.inspection.odometer !== '' && draft.inspection.photoKeys.length >= 4,
      deposit: true,
      review: true,
    }),
    [draft, datesValid],
  );

  const idx = STEPS.indexOf(step);
  const goNext = () => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]!);
  const goBack = () => setStep(STEPS[Math.max(0, idx - 1)]!);

  const submit = () => {
    const body: CheckoutRequest = {
      customerId: draft.customerId,
      vehicleId: draft.vehicleId,
      startAt: toIso(draft.startLocal),
      endAt: toIso(draft.endLocal),
      withDriver: draft.withDriver,
      overrideLicence: draft.overrideLicence || undefined,
      depositMethod: draft.depositMethod,
      inspection: {
        odometer: Number(draft.inspection.odometer),
        fuelEighths: draft.inspection.fuelEighths,
        checklist: draft.inspection.checklist,
        notes: draft.inspection.notes || undefined,
        photoKeys: draft.inspection.photoKeys,
        signatureKey: draft.signatureKey,
        damages: draft.inspection.damages,
      },
    };
    checkout.mutate(body, {
      onSuccess: (res) => {
        localStorage.removeItem(DRAFT_KEY);
        navigate(`/rentals/${res.data.id}`);
      },
      onSettled: () => setConfirmOpen(false),
    });
  };

  const topError = checkout.error instanceof ApiError ? checkout.error.message : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('agreements.checkout')}</h1>

      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={
              'rounded-full px-3 py-1 ' +
              (i === idx ? 'bg-primary text-white' : i < idx ? 'bg-primary-100 text-primary' : 'bg-surface-alt text-muted')
            }
          >
            {i + 1}. {t(`agreements.steps.${s}`)}
          </li>
        ))}
      </ol>

      {topError && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {topError}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface p-4 shadow-card">
        {step === 'customer' && (
          <div>
            {draft.customerId ? (
              <div className="flex items-center justify-between">
                <span className="font-medium">{draft.customerName}</span>
                <Button variant="ghost" onClick={() => set({ customerId: '', customerName: '' })}>
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 rounded-md border border-border px-3">
                  <Search size={16} className="text-muted" aria-hidden />
                  <input
                    className="min-h-[44px] flex-1 bg-transparent focus:outline-none"
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
                          onClick={() => set({ customerId: c.id, customerName: c.fullName })}
                        >
                          <span>{c.fullName}</span>
                          <span className="font-mono text-xs text-muted">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {canCharge && (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={draft.overrideLicence} onChange={(e) => set({ overrideLicence: e.target.checked })} className="h-5 w-5" />
                    {t('reservations.overrideLicence')}
                  </label>
                )}
              </>
            )}
          </div>
        )}

        {step === 'vehicle' && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t('reservations.startAt')} type="datetime-local" value={draft.startLocal} onChange={(e) => set({ startLocal: e.target.value })} />
              <TextField label={t('reservations.endAt')} type="datetime-local" value={draft.endLocal} onChange={(e) => set({ endLocal: e.target.value })} />
            </div>
            {datesValid && (
              <div className="flex flex-wrap gap-2">
                {(availability.data?.data ?? []).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => set({ vehicleId: v.id })}
                    className={'rounded-md border px-3 py-2 text-sm ' + (draft.vehicleId === v.id ? 'border-accent bg-primary-100' : 'border-border hover:bg-surface-alt')}
                  >
                    <span className="font-mono font-medium">{v.plateNumber}</span> · {v.make} {v.model}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.withDriver} onChange={(e) => set({ withDriver: e.target.checked })} className="h-5 w-5" />
              {t('agreements.withDriver')}
            </label>
          </div>
        )}

        {step === 'inspection' && (
          <InspectionFields value={draft.inspection} onChange={(inspection) => set({ inspection })} canCharge={false} />
        )}

        {step === 'deposit' && (
          <div className="flex flex-col gap-4">
            <SelectField
              label={t('agreements.depositMethod')}
              value={draft.depositMethod}
              onChange={(e) => set({ depositMethod: e.target.value as PaymentMethod })}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`invoices.method_${m}`) }))}
            />
            {quote.data && (
              <div>
                <p className="mb-1 text-sm font-medium">{t('agreements.deposit')}</p>
                <BreakdownTable breakdown={quote.data.data} />
              </div>
            )}
          </div>
        )}

        {step === 'review' && quote.data && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{draft.customerName}</p>
            <BreakdownTable breakdown={quote.data.data} />
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <Button variant="secondary" onClick={idx === 0 ? () => navigate('/rentals') : goBack}>
          {idx === 0 ? t('common.cancel') : t('agreements.back')}
        </Button>
        {step === 'review' ? (
          <Button variant="accent" onClick={() => setConfirmOpen(true)}>
            {t('agreements.confirmCheckout')}
          </Button>
        ) : (
          <Button variant="accent" disabled={!stepValid[step]} onClick={goNext}>
            {t('agreements.next')}
          </Button>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('agreements.confirmCheckout')}>
        <p className="mb-4 text-sm text-foreground">{t('agreements.confirmCheckoutBody')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="accent" disabled={checkout.isPending} onClick={submit}>
            {t('agreements.confirmCheckout')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

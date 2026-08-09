import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CheckinRequest, PaymentMethod, SettlementResult } from '@hosni/shared';
import { PAYMENT_METHODS } from '@hosni/shared';
import { agreementsApi } from './api';
import { useAgreement, useCheckin } from './hooks';
import { InspectionFields, emptyInspection, type InspectionValue } from './InspectionFields';
import { useAuth } from '../auth/hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Modal } from '../../components/ui/Modal';
import { Money } from '../../components/ui/Money';
import { BreakdownTable } from '../../components/ui/BreakdownTable';
import { ErrorState } from '../../components/ui/states';
import { ApiError } from '../../lib/apiClient';
import { DamageBadge } from './DamageList';

const STEPS = ['readings', 'settlement', 'payment'] as const;
type Step = (typeof STEPS)[number];

export default function CheckinWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data: me } = useAuth();
  const canCharge = me ? ['OWNER', 'MANAGER'].includes(me.role) : false;

  const agreementQuery = useAgreement(id);
  const checkin = useCheckin(id);

  const [step, setStep] = useState<Step>('readings');
  const [inspection, setInspection] = useState<InspectionValue>(emptyInspection);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inspectionPayload = (): CheckinRequest => ({
    inspection: {
      odometer: Number(inspection.odometer || 0),
      fuelEighths: inspection.fuelEighths,
      checklist: inspection.checklist,
      notes: inspection.notes || undefined,
      photoKeys: inspection.photoKeys,
      signatureKey: inspection.signatureKey,
      damages: inspection.damages,
    },
  });

  const readingsReady = inspection.odometer !== '';

  // Server-computed settlement preview (§5.6 — never computed in the browser).
  const settlement = useQuery({
    queryKey: ['settlement', id, inspection.odometer, inspection.fuelEighths, JSON.stringify(inspection.damages)],
    queryFn: () => agreementsApi.settlementPreview(id, inspectionPayload()),
    enabled: step === 'settlement' && readingsReady,
  });

  if (agreementQuery.isError) return <ErrorState onRetry={() => agreementQuery.refetch()} />;
  if (!agreementQuery.data) return <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>;
  const agreement = agreementQuery.data.data;

  const s: SettlementResult | undefined = settlement.data?.data;
  const idx = STEPS.indexOf(step);

  const submit = () => {
    const body = inspectionPayload();
    if (payAmount && Number(payAmount) > 0) {
      body.payment = { amount: payAmount, method: payMethod };
    }
    checkin.mutate(body, {
      onSuccess: () => navigate(`/rentals/${id}`),
      onSettled: () => setConfirmOpen(false),
    });
  };

  const topError = checkin.error instanceof ApiError ? checkin.error.message : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-bold text-foreground">
        {t('agreements.checkin')} · #{agreement.agreementNumber}
      </h1>
      <p className="mb-4 font-mono text-sm text-muted">{agreement.vehiclePlate}</p>

      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((st, i) => (
          <li key={st} className={'rounded-full px-3 py-1 ' + (i === idx ? 'bg-primary text-white' : i < idx ? 'bg-primary-100 text-primary' : 'bg-surface-alt text-muted')}>
            {i + 1}. {t(`agreements.checkinSteps.${st}`)}
          </li>
        ))}
      </ol>

      {topError && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {topError}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface p-4 shadow-card">
        {step === 'readings' && (
          <div className="flex flex-col gap-4">
            {agreement.preExistingDamages.length > 0 && (
              <div className="rounded-md border-2 border-dashed border-muted bg-surface-alt p-3">
                <p className="mb-2 text-sm font-semibold text-foreground">{t('agreements.preExisting')}</p>
                <div className="flex flex-wrap gap-2">
                  {agreement.preExistingDamages.map((d) => (
                    <DamageBadge key={d.id} damage={d} preExisting />
                  ))}
                </div>
              </div>
            )}
            <InspectionFields value={inspection} onChange={setInspection} canCharge={canCharge} />
          </div>
        )}

        {step === 'settlement' && (
          <div>
            {settlement.isLoading ? (
              <p className="text-sm text-muted">{t('common.loading')}</p>
            ) : settlement.isError ? (
              <ErrorState onRetry={() => settlement.refetch()} />
            ) : s ? (
              <div className="flex flex-col gap-4">
                <BreakdownTable breakdown={{ lines: s.lines, subtotal: s.subtotal, vat: s.vat, total: s.grandTotal, deposit: s.depositHeld, chargedDays: 0, composition: { months: 0, weeks: 0, days: 0, extraHours: 0 } }} />
                <div className="rounded-md bg-primary p-4 text-center text-white">
                  {Number(s.balanceDue) > 0 ? (
                    <>
                      <div className="text-sm opacity-80">{t('agreements.balanceDue')}</div>
                      <div className="text-2xl font-bold"><Money value={s.balanceDue} /></div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm opacity-80">{t('agreements.refundDue')}</div>
                      <div className="text-2xl font-bold"><Money value={s.refundDue} /></div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {step === 'payment' && (
          <div className="flex flex-col gap-4">
            <SelectField
              label={t('invoices.method')}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`invoices.method_${m}`) }))}
            />
            <TextField
              label={t('invoices.amount')}
              inputMode="decimal"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              helper={s ? `${t('agreements.balanceDue')}: ${s.balanceDue}` : undefined}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <Button
          variant="secondary"
          onClick={idx === 0 ? () => navigate(`/rentals/${id}`) : () => setStep(STEPS[idx - 1]!)}
        >
          {idx === 0 ? t('common.cancel') : t('agreements.back')}
        </Button>
        {step === 'payment' ? (
          <Button variant="accent" onClick={() => setConfirmOpen(true)}>
            {t('agreements.confirmCheckin')}
          </Button>
        ) : (
          <Button
            variant="accent"
            disabled={step === 'readings' && !readingsReady}
            onClick={() => {
              if (step === 'settlement' && s && !payAmount) setPayAmount(s.balanceDue);
              setStep(STEPS[idx + 1]!);
            }}
          >
            {t('agreements.next')}
          </Button>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('agreements.confirmCheckin')}>
        <p className="mb-4 text-sm text-foreground">{t('agreements.confirmCheckinBody')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="accent" disabled={checkin.isPending} onClick={submit}>
            {t('agreements.confirmCheckin')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

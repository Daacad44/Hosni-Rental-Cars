import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrgSettingsRequest, OrgSettingsView } from '@hosni/shared';
import { useOrgSettings, useUpdateOrgSettings } from './hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { TableSkeleton, ErrorState } from '../../components/ui/states';
import { ApiError } from '../../lib/apiClient';

/**
 * Organization settings form (§15). OWNER-only (the route and the sidebar both
 * gate it). Each save is audit-logged on the server and only changes future
 * pricing — the note on screen says so.
 */
export default function OrganizationSettings() {
  const q = useOrgSettings();
  if (q.isLoading) return <TableSkeleton rows={5} cols={2} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return <OrgForm initial={q.data!.data} />;
}

function OrgForm({ initial }: { initial: OrgSettingsView }) {
  const { t } = useTranslation();
  const update = useUpdateOrgSettings();
  const [form, setForm] = useState<OrgSettingsView>(initial);
  const [saved, setSaved] = useState(false);

  const num = (key: keyof OrgSettingsView) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: Number(e.target.value) }));
  const str = (key: keyof OrgSettingsView) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    setSaved(false);
    const body: OrgSettingsRequest = {
      vatRate: form.vatRate,
      graceMinutes: form.graceMinutes,
      timezone: form.timezone,
      currency: form.currency,
      serviceIntervalKm: form.serviceIntervalKm,
      serviceIntervalDays: form.serviceIntervalDays,
      serviceThresholdKm: form.serviceThresholdKm,
      serviceThresholdDays: form.serviceThresholdDays,
      fuelChargePerEighth: form.fuelChargePerEighth,
    };
    update.mutate(body, { onSuccess: () => setSaved(true) });
  };

  const topError = update.error instanceof ApiError ? update.error.message : null;

  return (
    <div className="max-w-2xl">
      <p className="mb-4 rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-muted">
        {t('settings.org.auditNote')}
      </p>

      {topError && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {topError}
        </div>
      )}
      {saved && !topError && (
        <div role="status" className="mb-4 rounded-sm border border-success bg-surface-alt px-3 py-2 text-sm text-success">
          {t('settings.org.saved')}
        </div>
      )}

      <div className="grid gap-4 rounded-md border border-border bg-surface p-4 shadow-card sm:grid-cols-2">
        <TextField label={t('settings.org.vatRate')} inputMode="decimal" value={form.vatRate} onChange={str('vatRate')} />
        <TextField label={t('settings.org.fuelChargePerEighth')} inputMode="decimal" value={form.fuelChargePerEighth} onChange={str('fuelChargePerEighth')} />
        <TextField label={t('settings.org.graceMinutes')} type="number" inputMode="numeric" value={String(form.graceMinutes)} onChange={num('graceMinutes')} />
        <TextField label={t('settings.org.currency')} value={form.currency} onChange={str('currency')} />
        <TextField label={t('settings.org.timezone')} value={form.timezone} onChange={str('timezone')} />
        <div />
        <TextField label={t('settings.org.serviceIntervalKm')} type="number" inputMode="numeric" value={String(form.serviceIntervalKm)} onChange={num('serviceIntervalKm')} />
        <TextField label={t('settings.org.serviceIntervalDays')} type="number" inputMode="numeric" value={String(form.serviceIntervalDays)} onChange={num('serviceIntervalDays')} />
        <TextField label={t('settings.org.serviceThresholdKm')} type="number" inputMode="numeric" value={String(form.serviceThresholdKm)} onChange={num('serviceThresholdKm')} />
        <TextField label={t('settings.org.serviceThresholdDays')} type="number" inputMode="numeric" value={String(form.serviceThresholdDays)} onChange={num('serviceThresholdDays')} />
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="accent" disabled={update.isPending} onClick={submit}>
          {t('settings.org.save')}
        </Button>
      </div>
    </div>
  );
}

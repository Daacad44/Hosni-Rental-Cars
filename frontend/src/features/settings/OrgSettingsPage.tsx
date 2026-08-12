import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { updateOrgSettingsSchema, type UpdateOrgSettingsRequest } from '@hosni/shared';
import { useOrgSettings, useUpdateOrgSettings } from './hooks';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/states';
import { ApiError } from '../../lib/apiClient';

type FormValues = UpdateOrgSettingsRequest;

export default function OrgSettingsPage() {
  const { t } = useTranslation();
  const settings = useOrgSettings();
  const update = useUpdateOrgSettings();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(updateOrgSettingsSchema),
    values: settings.data
      ? {
          name: settings.data.data.name,
          timezone: settings.data.data.timezone,
          currency: settings.data.data.currency,
          vatRate: settings.data.data.vatRate,
          graceMinutes: settings.data.data.graceMinutes,
          fuelChargePerEighth: settings.data.data.fuelChargePerEighth,
          noShowHours: settings.data.data.noShowHours,
          serviceIntervalKm: settings.data.data.serviceIntervalKm,
          serviceIntervalDays: settings.data.data.serviceIntervalDays,
          serviceThresholdKm: settings.data.data.serviceThresholdKm,
          serviceThresholdDays: settings.data.data.serviceThresholdDays,
        }
      : undefined,
  });

  if (settings.isError) return <ErrorState onRetry={() => settings.refetch()} />;
  if (!settings.data) return <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>;

  const onSubmit = handleSubmit((values) => update.mutate(values));
  const topError = update.error instanceof ApiError ? update.error.message : null;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      {topError && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {topError}
        </div>
      )}
      {update.isSuccess && (
        <div className="mb-4 rounded-sm border border-success bg-surface-alt px-3 py-2 text-sm text-success">
          {t('settings.org.saved')}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('settings.org.name')} error={errors.name?.message} {...register('name')} />
        <TextField label={t('settings.org.timezone')} error={errors.timezone?.message} {...register('timezone')} />
        <TextField label={t('settings.org.currency')} error={errors.currency?.message} {...register('currency')} />
        <TextField label={t('settings.org.vatRate')} inputMode="decimal" error={errors.vatRate?.message} {...register('vatRate')} />
        <TextField label={t('settings.org.graceMinutes')} type="number" inputMode="numeric" error={errors.graceMinutes?.message} {...register('graceMinutes', { valueAsNumber: true })} />
        <TextField label={t('settings.org.fuelChargePerEighth')} inputMode="decimal" error={errors.fuelChargePerEighth?.message} {...register('fuelChargePerEighth')} />
        <TextField label={t('settings.org.noShowHours')} type="number" inputMode="numeric" error={errors.noShowHours?.message} {...register('noShowHours', { valueAsNumber: true })} />
        <TextField label={t('settings.org.serviceIntervalKm')} type="number" inputMode="numeric" error={errors.serviceIntervalKm?.message} {...register('serviceIntervalKm', { valueAsNumber: true })} />
        <TextField label={t('settings.org.serviceIntervalDays')} type="number" inputMode="numeric" error={errors.serviceIntervalDays?.message} {...register('serviceIntervalDays', { valueAsNumber: true })} />
        <TextField label={t('settings.org.serviceThresholdKm')} type="number" inputMode="numeric" error={errors.serviceThresholdKm?.message} {...register('serviceThresholdKm', { valueAsNumber: true })} />
        <TextField label={t('settings.org.serviceThresholdDays')} type="number" inputMode="numeric" error={errors.serviceThresholdDays?.message} {...register('serviceThresholdDays', { valueAsNumber: true })} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="accent" type="submit" disabled={update.isPending}>
          {t('settings.org.save')}
        </Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { RateCardRequest, RateCardView } from '@hosni/shared';
import { useRateCards, useRateCardMutation } from './hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Modal } from '../../components/ui/Modal';
import { Money } from '../../components/ui/Money';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';

const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Amount like 50.00');
const formSchema = z.object({
  category: z.string().min(1),
  dailyRate: money,
  weeklyRate: z.string().optional(),
  monthlyRate: z.string().optional(),
  includedKmPerDay: z.string().optional(),
  extraKmRate: money,
  depositAmount: money,
  lateHourRate: money,
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
  vehicleId: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export default function RateCardsPage() {
  const { t } = useTranslation();
  const cards = useRateCards();
  const mutation = useRateCardMutation();
  const [editing, setEditing] = useState<RateCardView | null>(null);
  const [open, setOpen] = useState(false);

  const rows = cards.data?.data ?? [];

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (card: RateCardView) => {
    setEditing(card);
    setOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('settings.rateCards')}</h1>
          <p className="text-sm text-muted">{t('settings.rateCardsSubtitle')}</p>
        </div>
        <Button variant="accent" onClick={openNew}>
          <Plus size={18} aria-hidden />
          {t('settings.addRateCard')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {cards.isLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : cards.isError ? (
          <ErrorState onRetry={() => cards.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('settings.noRateCards')}
            body={t('settings.noRateCardsBody')}
            action={
              <Button variant="accent" onClick={openNew}>
                <Plus size={18} aria-hidden />
                {t('settings.addRateCard')}
              </Button>
            }
          />
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-surface-alt text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-4 py-3 text-start">{t('settings.category')}</th>
                <th className="px-4 py-3 text-end">{t('settings.dailyRate')}</th>
                <th className="px-4 py-3 text-end">{t('settings.weeklyRate')}</th>
                <th className="px-4 py-3 text-end">{t('settings.monthlyRate')}</th>
                <th className="px-4 py-3 text-end">{t('settings.includedKmPerDay')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="h-row border-t border-border text-sm">
                  <td className="px-4 py-2 font-medium">
                    {c.category}
                    {c.vehicleId && <span className="ms-1 text-xs text-muted">·override</span>}
                  </td>
                  <td className="px-4 py-2 text-end"><Money value={c.dailyRate} /></td>
                  <td className="px-4 py-2 text-end">{c.weeklyRate ? <Money value={c.weeklyRate} /> : '—'}</td>
                  <td className="px-4 py-2 text-end">{c.monthlyRate ? <Money value={c.monthlyRate} /> : '—'}</td>
                  <td className="px-4 py-2 text-end font-mono tabular">
                    {c.includedKmPerDay === null ? t('settings.unlimited') : c.includedKmPerDay}
                  </td>
                  <td className="px-4 py-2 text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="px-2" onClick={() => openEdit(c)} aria-label={t('settings.editRateCard')}>
                        <Pencil size={16} aria-hidden />
                      </Button>
                      <Button variant="ghost" className="px-2 text-error" onClick={() => mutation.remove.mutate(c.id)} aria-label={t('common.cancel')}>
                        <Trash2 size={16} aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <RateCardModal
          key={editing?.id ?? 'new'}
          editing={editing}
          onClose={() => setOpen(false)}
          onSubmit={(body, id) => {
            const done = () => setOpen(false);
            if (id) mutation.update.mutate({ id, body }, { onSuccess: done });
            else mutation.create.mutate(body, { onSuccess: done });
          }}
          pending={mutation.create.isPending || mutation.update.isPending}
        />
      )}
    </div>
  );
}

function RateCardModal({
  editing,
  onClose,
  onSubmit,
  pending,
}: {
  editing: RateCardView | null;
  onClose: () => void;
  onSubmit: (body: RateCardRequest & { vehicleId?: string | null }, id?: string) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: editing
      ? {
          category: editing.category,
          dailyRate: editing.dailyRate,
          weeklyRate: editing.weeklyRate ?? '',
          monthlyRate: editing.monthlyRate ?? '',
          includedKmPerDay: editing.includedKmPerDay === null ? '' : String(editing.includedKmPerDay),
          extraKmRate: editing.extraKmRate,
          depositAmount: editing.depositAmount,
          lateHourRate: editing.lateHourRate,
          effectiveFrom: editing.effectiveFrom.slice(0, 10),
          effectiveTo: editing.effectiveTo?.slice(0, 10) ?? '',
          vehicleId: editing.vehicleId ?? '',
        }
      : { effectiveFrom: new Date().toISOString().slice(0, 10) },
  });

  const submit = handleSubmit((v) => {
    const body: RateCardRequest & { vehicleId?: string | null } = {
      category: v.category,
      dailyRate: v.dailyRate,
      weeklyRate: v.weeklyRate ? v.weeklyRate : null,
      monthlyRate: v.monthlyRate ? v.monthlyRate : null,
      includedKmPerDay: v.includedKmPerDay ? Number(v.includedKmPerDay) : null,
      extraKmRate: v.extraKmRate,
      depositAmount: v.depositAmount,
      lateHourRate: v.lateHourRate,
      effectiveFrom: new Date(v.effectiveFrom).toISOString(),
      effectiveTo: v.effectiveTo ? new Date(v.effectiveTo).toISOString() : null,
      vehicleId: v.vehicleId ? v.vehicleId : null,
    };
    onSubmit(body, editing?.id);
  });

  return (
    <Modal open onClose={onClose} title={editing ? t('settings.editRateCard') : t('settings.addRateCard')}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <TextField label={t('settings.category')} error={errors.category?.message} {...register('category')} />
        <TextField label={t('settings.dailyRate')} inputMode="decimal" error={errors.dailyRate?.message} {...register('dailyRate')} />
        <TextField label={t('settings.weeklyRate')} inputMode="decimal" {...register('weeklyRate')} />
        <TextField label={t('settings.monthlyRate')} inputMode="decimal" {...register('monthlyRate')} />
        <TextField label={t('settings.includedKmPerDay')} helper={t('settings.unlimitedKm')} inputMode="numeric" {...register('includedKmPerDay')} />
        <TextField label={t('settings.extraKmRate')} inputMode="decimal" error={errors.extraKmRate?.message} {...register('extraKmRate')} />
        <TextField label={t('settings.depositAmount')} inputMode="decimal" error={errors.depositAmount?.message} {...register('depositAmount')} />
        <TextField label={t('settings.lateHourRate')} inputMode="decimal" error={errors.lateHourRate?.message} {...register('lateHourRate')} />
        <TextField label={t('settings.effectiveFrom')} type="date" error={errors.effectiveFrom?.message} {...register('effectiveFrom')} />
        <TextField label={t('settings.effectiveTo')} type="date" {...register('effectiveTo')} />
        <TextField label={t('settings.vehicleOverride')} {...register('vehicleId')} />
        <div className="col-span-full mt-2 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="accent" type="submit" disabled={pending}>
            {t('settings.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

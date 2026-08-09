import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, FileWarning } from 'lucide-react';
import { VEHICLE_DOCUMENT_TYPES, type CreateVehicleDocumentRequest } from '@hosni/shared';
import { useVehicleDocuments, useDocumentMutation } from './hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';

const formSchema = z
  .object({
    type: z.enum(VEHICLE_DOCUMENT_TYPES),
    number: z.string().min(1),
    issueDate: z.string().min(1),
    expiryDate: z.string().min(1),
  })
  .refine((v) => new Date(v.expiryDate) > new Date(v.issueDate), {
    message: 'Expiry must be after issue',
    path: ['expiryDate'],
  });
type FormValues = z.infer<typeof formSchema>;

export function VehicleDocumentsTab({ vehicleId, canEdit }: { vehicleId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const docs = useVehicleDocuments(vehicleId);
  const mutation = useDocumentMutation(vehicleId);
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { type: 'INSURANCE' } });

  const onSubmit = handleSubmit((values) => {
    const body: CreateVehicleDocumentRequest = {
      type: values.type,
      number: values.number,
      issueDate: new Date(values.issueDate).toISOString(),
      expiryDate: new Date(values.expiryDate).toISOString(),
    };
    mutation.create.mutate(body, {
      onSuccess: () => {
        reset({ type: 'INSURANCE', number: '', issueDate: '', expiryDate: '' });
        setOpen(false);
      },
    });
  });

  const rows = docs.data?.data ?? [];

  return (
    <div>
      {canEdit && (
        <div className="mb-3 flex justify-end">
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={18} aria-hidden />
            {t('fleet.addDocument')}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {docs.isLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : docs.isError ? (
          <ErrorState onRetry={() => docs.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={t('fleet.noDocuments')} body={t('fleet.addDocument')} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((d) => {
              const expired = d.daysUntilExpiry < 0;
              const soon = d.daysUntilExpiry >= 0 && d.daysUntilExpiry <= 30;
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{t(`fleet.docType_${d.type}`)}</span>
                      {(expired || soon) && (
                        <StatusBadge
                          tone={expired ? 'error' : 'warning'}
                          label={
                            expired ? t('fleet.expired') : t('fleet.expiresIn', { days: d.daysUntilExpiry })
                          }
                          icon={<FileWarning size={12} aria-hidden />}
                        />
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted">{d.number}</p>
                    <p className="text-xs text-muted">
                      {d.issueDate.slice(0, 10)} → {d.expiryDate.slice(0, 10)}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      className="px-2 text-error"
                      aria-label={t('common.cancel')}
                      onClick={() => mutation.remove.mutate(d.id)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t('fleet.addDocument')}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <SelectField
            label={t('fleet.docType')}
            options={VEHICLE_DOCUMENT_TYPES.map((v) => ({ value: v, label: t(`fleet.docType_${v}`) }))}
            {...register('type')}
          />
          <TextField label={t('fleet.docNumber')} error={errors.number?.message} {...register('number')} />
          <TextField
            label={t('fleet.issueDate')}
            type="date"
            error={errors.issueDate?.message}
            {...register('issueDate')}
          />
          <TextField
            label={t('fleet.expiryDate')}
            type="date"
            error={errors.expiryDate?.message}
            {...register('expiryDate')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" type="submit" disabled={mutation.create.isPending}>
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

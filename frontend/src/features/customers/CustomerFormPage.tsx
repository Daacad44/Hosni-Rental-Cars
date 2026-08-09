import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { createCustomerSchema, type CreateCustomerRequest } from '@hosni/shared';
import { useCustomer, useCreateCustomer, useCustomerMutation } from './hooks';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/apiClient';

const formSchema = createCustomerSchema.extend({
  licenceExpiry: z.string().optional(),
  email: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export default function CustomerFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const existing = useCustomer(isEdit ? id : undefined);
  const createCustomer = useCreateCustomer();
  const mutation = useCustomerMutation(id ?? '');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: existing.data
      ? {
          fullName: existing.data.data.fullName,
          phone: existing.data.data.phone,
          email: existing.data.data.email ?? '',
          nationalId: existing.data.data.nationalId ?? '',
          licenceNumber: existing.data.data.licenceNumber ?? '',
          licenceExpiry: existing.data.data.licenceExpiry?.slice(0, 10) ?? '',
          address: existing.data.data.address ?? '',
          notes: existing.data.data.notes ?? '',
        }
      : undefined,
  });

  const onSubmit = handleSubmit((values) => {
    const payload: CreateCustomerRequest = {
      ...values,
      licenceExpiry: values.licenceExpiry ? new Date(values.licenceExpiry).toISOString() : undefined,
    };
    if (isEdit) mutation.update.mutate(payload, { onSuccess: () => navigate(`/customers/${id}`) });
    else createCustomer.mutate(payload, { onSuccess: (res) => navigate(`/customers/${res.data.id}`) });
  });

  const active = isEdit ? mutation.update : createCustomer;
  const topError = active.error instanceof ApiError ? active.error.message : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-foreground">
        {isEdit ? t('customers.edit') : t('customers.add')}
      </h1>
      {topError && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {topError}
        </div>
      )}
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField label={t('customers.fullName')} error={errors.fullName?.message} {...register('fullName')} />
        <TextField label={t('customers.phone')} type="tel" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
        <TextField label={t('customers.email')} type="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <TextField label={t('customers.nationalId')} error={errors.nationalId?.message} {...register('nationalId')} />
        <TextField label={t('customers.licenceNumber')} error={errors.licenceNumber?.message} {...register('licenceNumber')} />
        <TextField label={t('customers.licenceExpiry')} type="date" error={errors.licenceExpiry?.message} {...register('licenceExpiry')} />
        <TextField label={t('customers.address')} error={errors.address?.message} {...register('address')} />
        <TextField label={t('customers.notes')} error={errors.notes?.message} {...register('notes')} />
        <div className="col-span-full mt-2 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button variant="accent" type="submit" disabled={active.isPending}>
            {t('customers.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

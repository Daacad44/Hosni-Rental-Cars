import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createVehicleSchema,
  TRANSMISSIONS,
  FUEL_TYPES,
  type CreateVehicleRequest,
} from '@hosni/shared';

// The form edits the acquisition date as yyyy-MM-dd; it is widened to an ISO
// datetime on submit, where the server re-validates it. Everything else matches
// the shared create schema exactly.
const vehicleFormSchema = createVehicleSchema.extend({
  acquisitionDate: z.string().min(1, 'Required'),
});
import { useBranches } from '../branches/hooks';
import { useVehicle, useCreateVehicle, useUpdateVehicle } from './hooks';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/apiClient';

// Form values keep dates as yyyy-MM-dd; we widen to ISO on submit.
type FormValues = Omit<CreateVehicleRequest, 'acquisitionDate'> & { acquisitionDate: string };

export default function VehicleFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const branches = useBranches();
  const existing = useVehicle(isEdit ? id : undefined);
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle(id ?? '');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(vehicleFormSchema),
    values: existing.data
      ? {
          plateNumber: existing.data.data.plateNumber,
          vin: existing.data.data.vin,
          make: existing.data.data.make,
          model: existing.data.data.model,
          year: existing.data.data.year,
          category: existing.data.data.category,
          transmission: existing.data.data.transmission,
          fuelType: existing.data.data.fuelType,
          seats: existing.data.data.seats,
          colour: existing.data.data.colour,
          odometer: existing.data.data.odometer,
          acquisitionCost: existing.data.data.acquisitionCost,
          acquisitionDate: existing.data.data.acquisitionDate.slice(0, 10),
          branchId: existing.data.data.branchId,
        }
      : undefined,
  });

  const onSubmit = handleSubmit((values) => {
    const payload: CreateVehicleRequest = {
      ...values,
      acquisitionDate: new Date(values.acquisitionDate).toISOString(),
    };
    if (isEdit) {
      const { odometer: _odometer, ...editable } = payload;
      updateVehicle.mutate(editable, { onSuccess: () => navigate(`/fleet/${id}`) });
    } else {
      createVehicle.mutate(payload, { onSuccess: (res) => navigate(`/fleet/${res.data.id}`) });
    }
  });

  const mutation = isEdit ? updateVehicle : createVehicle;
  const topError = mutation.error instanceof ApiError ? mutation.error.message : null;
  const branchOptions = (branches.data?.data ?? []).map((b) => ({ value: b.id, label: b.name }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-foreground">
        {isEdit ? t('fleet.edit') : t('fleet.add')}
      </h1>

      {topError && (
        <div role="alert" className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {topError}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField label={t('fleet.plate')} error={errors.plateNumber?.message} {...register('plateNumber')} />
        <TextField label={t('fleet.vin')} error={errors.vin?.message} {...register('vin')} />
        <TextField label={t('fleet.make')} error={errors.make?.message} {...register('make')} />
        <TextField label={t('fleet.model')} error={errors.model?.message} {...register('model')} />
        <TextField
          label={t('fleet.year')}
          type="number"
          inputMode="numeric"
          error={errors.year?.message}
          {...register('year')}
        />
        <TextField label={t('fleet.category')} error={errors.category?.message} {...register('category')} />
        <SelectField
          label={t('fleet.transmission')}
          error={errors.transmission?.message}
          options={TRANSMISSIONS.map((v) => ({ value: v, label: t(`fleet.transmission_${v}`) }))}
          {...register('transmission')}
        />
        <SelectField
          label={t('fleet.fuelType')}
          error={errors.fuelType?.message}
          options={FUEL_TYPES.map((v) => ({ value: v, label: t(`fleet.fuel_${v}`) }))}
          {...register('fuelType')}
        />
        <TextField
          label={t('fleet.seats')}
          type="number"
          inputMode="numeric"
          error={errors.seats?.message}
          {...register('seats')}
        />
        <TextField label={t('fleet.colour')} error={errors.colour?.message} {...register('colour')} />
        {!isEdit && (
          <TextField
            label={t('fleet.odometer')}
            type="number"
            inputMode="numeric"
            error={errors.odometer?.message}
            {...register('odometer')}
          />
        )}
        <TextField
          label={t('fleet.acquisitionCost')}
          inputMode="decimal"
          error={errors.acquisitionCost?.message}
          {...register('acquisitionCost')}
        />
        <TextField
          label={t('fleet.acquisitionDate')}
          type="date"
          error={errors.acquisitionDate?.message}
          {...register('acquisitionDate')}
        />
        <SelectField
          label={t('fleet.branch')}
          placeholder={t('fleet.allBranches')}
          error={errors.branchId?.message}
          options={branchOptions}
          {...register('branchId')}
        />

        <div className="col-span-full mt-2 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button variant="accent" type="submit" disabled={mutation.isPending}>
            {t('fleet.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

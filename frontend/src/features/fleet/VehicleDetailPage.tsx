import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Ban, Gauge, Upload, X } from 'lucide-react';
import type { VehicleDetail } from '@hosni/shared';
import { useVehicle, useVehicleMutation, useVehiclePhotos, usePhotoMutation } from './hooks';
import { useAuth } from '../auth/hooks';
import { VehicleStatusBadge } from './VehicleStatusBadge';
import { VehicleDocumentsTab } from './VehicleDocumentsTab';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Modal } from '../../components/ui/Modal';
import { Money } from '../../components/ui/Money';
import { ErrorState } from '../../components/ui/states';

const TABS = [
  'overview',
  'availability',
  'rentals',
  'maintenance',
  'damages',
  'documents',
  'expenses',
  'profitability',
] as const;
type Tab = (typeof TABS)[number];

export default function VehicleDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data: me } = useAuth();
  const canEdit = me ? ['OWNER', 'MANAGER', 'MECHANIC'].includes(me.role) : false;

  const vehicleQuery = useVehicle(id);
  const [tab, setTab] = useState<Tab>('overview');

  if (vehicleQuery.isError) return <ErrorState onRetry={() => vehicleQuery.refetch()} />;
  if (!vehicleQuery.data) {
    return <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>;
  }
  const v = vehicleQuery.data.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-foreground">{v.plateNumber}</h1>
            <VehicleStatusBadge status={v.status} />
          </div>
          <p className="text-sm text-muted">
            {v.make} {v.model} · {v.year} · {v.branchName}
          </p>
          {v.isOutOfService && v.outOfServiceReason && (
            <p className="mt-1 text-sm text-error">
              {t('fleet.outOfService')}: {v.outOfServiceReason}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/fleet/${id}/edit`)}>
              <Pencil size={16} aria-hidden />
              {t('fleet.edit')}
            </Button>
            <OutOfServiceButton vehicle={v} />
            <OdometerButton vehicle={v} />
            <DeleteButton vehicleId={id} plate={v.plateNumber} />
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            aria-current={tab === tabKey ? 'page' : undefined}
            className={
              'min-h-[44px] whitespace-nowrap px-3 text-sm font-medium ' +
              (tab === tabKey
                ? 'border-b-2 border-accent text-foreground'
                : 'text-muted hover:text-foreground')
            }
          >
            {t(`fleet.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab vehicle={v} canEdit={canEdit} />}
      {tab === 'documents' && <VehicleDocumentsTab vehicleId={id} canEdit={canEdit} />}
      {tab !== 'overview' && tab !== 'documents' && (
        <div className="rounded-md border border-border bg-surface p-8 text-center text-sm text-muted">
          {t('common.comingSoon')}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function OverviewTab({ vehicle: v, canEdit }: { vehicle: VehicleDetail; canEdit: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <dl className="grid grid-cols-2 gap-4 rounded-md border border-border bg-surface p-4 shadow-card">
        <Field label={t('fleet.vin')}>
          <span className="font-mono">{v.vin}</span>
        </Field>
        <Field label={t('fleet.category')}>{v.category}</Field>
        <Field label={t('fleet.transmission')}>{t(`fleet.transmission_${v.transmission}`)}</Field>
        <Field label={t('fleet.fuelType')}>{t(`fleet.fuel_${v.fuelType}`)}</Field>
        <Field label={t('fleet.seats')}>{v.seats}</Field>
        <Field label={t('fleet.colour')}>{v.colour}</Field>
        <Field label={t('fleet.odometer')}>
          <span className="font-mono tabular">
            {v.odometer.toLocaleString()} {t('fleet.km')}
          </span>
        </Field>
        <Field label={t('fleet.acquisitionCost')}>
          <Money value={v.acquisitionCost} />
        </Field>
        <Field label={t('fleet.acquisitionDate')}>{v.acquisitionDate.slice(0, 10)}</Field>
      </dl>

      <PhotosSection vehicleId={v.id} canEdit={canEdit} />
    </div>
  );
}

function PhotosSection({ vehicleId, canEdit }: { vehicleId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const photos = useVehiclePhotos(vehicleId);
  const { upload, remove } = usePhotoMutation(vehicleId);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = photos.data?.data ?? [];

  return (
    <div className="rounded-md border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t('fleet.photos')}</h2>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              className="min-h-[44px]"
              disabled={upload.isPending || rows.length >= 10}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} aria-hidden />
              {t('fleet.addPhoto')}
            </Button>
          </>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t('fleet.noPhotos')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {rows.map((p) => (
            <div key={p.id} className="group relative aspect-video overflow-hidden rounded-sm bg-surface-alt">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              {canEdit && (
                <button
                  onClick={() => remove.mutate(p.id)}
                  className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/60 text-white"
                  aria-label={t('common.cancel')}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OdometerButton({ vehicle: v }: { vehicle: VehicleDetail }) {
  const { t } = useTranslation();
  const { odometer } = useVehicleMutation(v.id);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(v.odometer));
  const [reason, setReason] = useState('');
  const isRegression = Number(value) < v.odometer;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Gauge size={16} aria-hidden />
        {t('fleet.correctOdometer')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('fleet.correctOdometer')}>
        <div className="flex flex-col gap-4">
          <TextField
            label={t('fleet.odometer')}
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {isRegression && (
            <p className="text-xs text-accent-600">{t('fleet.odometerRegression')}</p>
          )}
          {isRegression && (
            <TextField
              label={t('fleet.odometerReason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="accent"
              disabled={odometer.isPending}
              onClick={() =>
                odometer.mutate(
                  { odometer: Number(value), reason: reason || undefined },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function OutOfServiceButton({ vehicle: v }: { vehicle: VehicleDetail }) {
  const { t } = useTranslation();
  const { outOfService } = useVehicleMutation(v.id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (v.isOutOfService) {
    return (
      <Button
        variant="secondary"
        disabled={outOfService.isPending}
        onClick={() => outOfService.mutate({ isOutOfService: false })}
      >
        {t('fleet.returnToService')}
      </Button>
    );
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Ban size={16} aria-hidden />
        {t('fleet.takeOutOfService')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('fleet.takeOutOfService')}>
        <div className="flex flex-col gap-4">
          <TextField
            label={t('fleet.outOfServiceReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={outOfService.isPending || reason.trim().length === 0}
              onClick={() =>
                outOfService.mutate(
                  { isOutOfService: true, reason },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {t('fleet.takeOutOfService')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function DeleteButton({ vehicleId, plate }: { vehicleId: string; plate: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { remove } = useVehicleMutation(vehicleId);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" className="text-error" onClick={() => setOpen(true)}>
        <Trash2 size={16} aria-hidden />
        {t('fleet.delete')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('fleet.delete')}>
        <p className="mb-4 text-sm text-foreground">{t('fleet.deleteConfirm', { plate })}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: () => navigate('/fleet') })}
          >
            {t('fleet.delete')}
          </Button>
        </div>
      </Modal>
    </>
  );
}

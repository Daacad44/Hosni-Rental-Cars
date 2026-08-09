import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CreateMaintenanceRequest } from '@hosni/shared';
import { useMaintenance, useMaintenanceMutation } from './hooks';
import { useAuth } from '../auth/hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Modal } from '../../components/ui/Modal';
import { Money } from '../../components/ui/Money';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';
import { ApiError } from '../../lib/apiClient';

export default function MaintenancePage() {
  const { t } = useTranslation();
  const { data: me } = useAuth();
  const canCost = me ? ['OWNER', 'MANAGER'].includes(me.role) : false;
  const query = useMaintenance(undefined, 1, 50);
  const mutation = useMaintenanceMutation();
  const [open, setOpen] = useState(false);

  const rows = query.data?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('maintenance.title')}</h1>
          <p className="text-sm text-muted">{t('maintenance.subtitle')}</p>
        </div>
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus size={18} aria-hidden />
          {t('maintenance.add')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {query.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={t('maintenance.empty')} body={t('maintenance.emptyBody')} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{m.type}</span>
                  <span className="ms-2 font-mono text-xs text-muted">{m.vehiclePlate}</span>
                  <p className="text-xs text-muted">
                    {new Date(m.scheduledStart).toLocaleDateString()} → {new Date(m.scheduledEnd).toLocaleDateString()}
                    {m.cost && (
                      <>
                        {' · '}
                        <Money value={m.cost} />
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={m.status === 'COMPLETED' ? 'success' : m.status === 'CANCELLED' ? 'neutral' : 'warning'} label={t(`maintenance.status_${m.status}`)} />
                  {m.status === 'SCHEDULED' && (
                    <Button variant="secondary" className="min-h-[36px]" onClick={() => mutation.updateStatus.mutate({ id: m.id, body: { status: 'IN_PROGRESS' } })}>
                      {t('maintenance.markInProgress')}
                    </Button>
                  )}
                  {(m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS') && (
                    <Button variant="accent" className="min-h-[36px]" onClick={() => mutation.updateStatus.mutate({ id: m.id, body: { status: 'COMPLETED' } })}>
                      {t('maintenance.complete')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <CreateModal canCost={canCost} onClose={() => setOpen(false)} onCreate={(body, opts) => mutation.create.mutate(body, opts)} pending={mutation.create.isPending} error={mutation.create.error} />}
    </div>
  );
}

function CreateModal({
  canCost,
  onClose,
  onCreate,
  pending,
  error,
}: {
  canCost: boolean;
  onClose: () => void;
  onCreate: (body: CreateMaintenanceRequest, opts: { onSuccess: () => void }) => void;
  pending: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [force, setForce] = useState(false);

  const overlap = error instanceof ApiError && error.code === 'CONFLICT';

  const submit = () => {
    const body: CreateMaintenanceRequest = {
      vehicleId,
      type,
      scheduledStart: new Date(start).toISOString(),
      scheduledEnd: new Date(end).toISOString(),
      vendor: vendor || undefined,
      cost: canCost && cost ? cost : undefined,
      force: force || undefined,
    };
    onCreate(body, { onSuccess: onClose });
  };

  return (
    <Modal open onClose={onClose} title={t('maintenance.add')}>
      <div className="flex flex-col gap-3">
        {overlap && (
          <div className="rounded-sm border border-accent-600 bg-surface-alt px-3 py-2 text-sm text-accent-600">
            {t('maintenance.overlapWarning')}
            <label className="mt-1 flex items-center gap-2">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4" />
              {t('maintenance.confirmOverlap')}
            </label>
          </div>
        )}
        <TextField label={t('maintenance.vehicle')} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} helper="Vehicle ID" />
        <TextField label={t('maintenance.type')} value={type} onChange={(e) => setType(e.target.value)} />
        <TextField label={t('maintenance.scheduledStart')} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <TextField label={t('maintenance.scheduledEnd')} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        <TextField label={t('maintenance.vendor')} value={vendor} onChange={(e) => setVendor(e.target.value)} />
        {canCost && <TextField label={t('maintenance.cost')} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="accent" disabled={pending || !vehicleId || !type || !start || !end} onClick={submit}>
            {t('maintenance.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

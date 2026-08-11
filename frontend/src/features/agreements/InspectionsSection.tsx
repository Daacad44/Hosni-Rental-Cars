import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import type { InspectionView, CheckinRequest } from '@hosni/shared';
import { useInspections, useCorrectInspection } from './hooks';
import { InspectionFields, type InspectionValue } from './InspectionFields';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';
import { ApiError } from '../../lib/apiClient';

/**
 * The inspection history for an agreement, with an append-only correction flow
 * (§5.7). Correcting an inspection never edits the original: it writes a new
 * record that supersedes it, so the trail is preserved. A superseded record is
 * badged and can no longer be corrected — correct the current one instead.
 */
export function InspectionsSection({ agreementId, canCorrect }: { agreementId: string; canCorrect: boolean }) {
  const { t } = useTranslation();
  const q = useInspections(agreementId);
  const [target, setTarget] = useState<InspectionView | null>(null);

  return (
    <div className="rounded-md border border-border bg-surface p-4 shadow-card">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{t('agreements.inspections')}</h2>
      {q.isLoading ? (
        <TableSkeleton rows={2} cols={3} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (q.data?.data ?? []).length === 0 ? (
        <EmptyState title={t('agreements.noInspections')} body="" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {(q.data?.data ?? []).map((insp) => (
            <li key={insp.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t(`agreements.inspectionType_${insp.type}`)}</span>
                <span className="font-mono text-muted">{insp.odometer.toLocaleString()} km · {insp.fuelEighths}/8</span>
                {insp.supersedesId && <StatusBadge tone="warning" label={t('agreements.correction')} />}
                {insp.superseded && <StatusBadge tone="neutral" label={t('agreements.superseded')} />}
                <span className="text-xs text-muted">{new Date(insp.createdAt).toLocaleString()}</span>
              </div>
              {canCorrect && !insp.superseded && (
                <Button variant="ghost" onClick={() => setTarget(insp)}>
                  <Pencil size={14} aria-hidden />
                  {t('agreements.correct')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {target && (
        <CorrectionModal
          agreementId={agreementId}
          inspection={target}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function CorrectionModal({
  agreementId,
  inspection,
  onClose,
}: {
  agreementId: string;
  inspection: InspectionView;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const correct = useCorrectInspection(agreementId);
  const [reason, setReason] = useState('');
  const [value, setValue] = useState<InspectionValue>({
    odometer: String(inspection.odometer),
    fuelEighths: inspection.fuelEighths,
    checklist: inspection.checklist,
    notes: inspection.notes ?? '',
    photoKeys: [],
    damages: [],
  });

  const submit = () => {
    const body: CheckinRequest['inspection'] = {
      odometer: Number(value.odometer || 0),
      fuelEighths: value.fuelEighths,
      checklist: value.checklist,
      notes: value.notes || undefined,
      photoKeys: value.photoKeys,
      signatureKey: value.signatureKey,
      damages: value.damages,
    };
    correct.mutate({ inspectionId: inspection.id, body: { reason, inspection: body } }, { onSuccess: onClose });
  };

  const topError = correct.error instanceof ApiError ? correct.error.message : null;

  return (
    <Modal open onClose={onClose} title={t('agreements.correctInspection')}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted">{t('agreements.correctionNote')}</p>
        {topError && (
          <div role="alert" className="rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
            {topError}
          </div>
        )}
        <TextField
          label={t('agreements.correctReason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <InspectionFields value={value} onChange={setValue} canCharge={false} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="accent"
            disabled={correct.isPending || reason.trim().length === 0 || value.odometer === ''}
            onClick={submit}
          >
            {t('agreements.saveCorrection')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

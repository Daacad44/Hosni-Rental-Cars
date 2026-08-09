import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Trash2, Plus } from 'lucide-react';
import {
  DAMAGE_PANELS,
  DAMAGE_SEVERITIES,
  type InspectionChecklist,
  type DamageInput,
} from '@hosni/shared';
import { uploadFile } from '../../lib/uploads';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';

export interface InspectionValue {
  odometer: string;
  fuelEighths: number;
  checklist: InspectionChecklist;
  notes: string;
  photoKeys: string[];
  signatureKey?: string;
  damages: DamageInput[];
}

export const emptyInspection = (): InspectionValue => ({
  odometer: '',
  fuelEighths: 8,
  checklist: { tyres: true, lights: true, spare: true, tools: true, documents: true, cleanliness: true },
  notes: '',
  photoKeys: [],
  damages: [],
});

const CHECK_KEYS: (keyof InspectionChecklist)[] = ['tyres', 'lights', 'spare', 'tools', 'documents', 'cleanliness'];

export function InspectionFields({
  value,
  onChange,
  canCharge,
}: {
  value: InspectionValue;
  onChange: (v: InspectionValue) => void;
  canCharge: boolean;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<InspectionValue>) => onChange({ ...value, ...patch });

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const keys = await Promise.all(Array.from(files).map((f) => uploadFile(f)));
      set({ photoKeys: [...value.photoKeys, ...keys] });
    } finally {
      setUploading(false);
    }
  };

  const addDamage = () =>
    set({ damages: [...value.damages, { panel: 'FRONT_BUMPER', severity: 'MINOR' }] });
  const updateDamage = (i: number, patch: Partial<DamageInput>) =>
    set({ damages: value.damages.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const removeDamage = (i: number) => set({ damages: value.damages.filter((_, idx) => idx !== i) });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('agreements.odometer')}
          type="number"
          inputMode="numeric"
          value={value.odometer}
          onChange={(e) => set({ odometer: e.target.value })}
          helper={t('agreements.odometerRequired')}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="fuel" className="text-sm font-medium text-foreground">
            {t('agreements.fuel')}: {value.fuelEighths}/8
          </label>
          <input
            id="fuel"
            type="range"
            min={0}
            max={8}
            value={value.fuelEighths}
            onChange={(e) => set({ fuelEighths: Number(e.target.value) })}
            className="min-h-[44px]"
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">{t('agreements.checklist')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHECK_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.checklist[k]}
                onChange={(e) => set({ checklist: { ...value.checklist, [k]: e.target.checked } })}
                className="h-5 w-5"
              />
              {t(`agreements.check_${k}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {t('agreements.photos')} ({value.photoKeys.length})
          </span>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm">
            <Upload size={16} aria-hidden />
            {uploading ? t('common.loading') : t('agreements.addPhotos')}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
          </label>
        </div>
        <p className="text-xs text-muted">{t('agreements.photosRequired')}</p>
      </div>

      <TextField label={t('agreements.notes')} value={value.notes} onChange={(e) => set({ notes: e.target.value })} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{t('agreements.damage')}</span>
          <Button variant="secondary" onClick={addDamage}>
            <Plus size={16} aria-hidden />
            {t('agreements.addDamage')}
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {value.damages.map((d, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <SelectField
                label={t('agreements.panel')}
                value={d.panel}
                onChange={(e) => updateDamage(i, { panel: e.target.value as DamageInput['panel'] })}
                options={DAMAGE_PANELS.map((p) => ({ value: p, label: p.replace(/_/g, ' ') }))}
              />
              <SelectField
                label={t('agreements.severity')}
                value={d.severity}
                onChange={(e) => updateDamage(i, { severity: e.target.value as DamageInput['severity'] })}
                options={DAMAGE_SEVERITIES.map((s) => ({ value: s, label: t(`agreements.severity_${s}`) }))}
              />
              {canCharge && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={d.chargeable ?? false}
                      onChange={(e) => updateDamage(i, { chargeable: e.target.checked })}
                      className="h-5 w-5"
                    />
                    {t('agreements.chargeable')}
                  </label>
                  {d.chargeable && (
                    <TextField
                      label={t('agreements.chargeAmount')}
                      inputMode="decimal"
                      value={d.chargeAmount ?? ''}
                      onChange={(e) => updateDamage(i, { chargeAmount: e.target.value })}
                    />
                  )}
                </>
              )}
              <div className="sm:col-span-2 flex justify-end">
                <Button variant="ghost" className="text-error" onClick={() => removeDamage(i)}>
                  <Trash2 size={16} aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

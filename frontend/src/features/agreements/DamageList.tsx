import { useTranslation } from 'react-i18next';
import { History, AlertTriangle } from 'lucide-react';
import type { DamageView } from '@hosni/shared';
import { Money } from '../../components/ui/Money';

/**
 * A damage chip. Pre-existing damage is distinguished by a dashed border and a
 * history icon; new damage by a solid border and a warning icon — so the two
 * are distinguishable without relying on colour.
 */
export function DamageBadge({ damage, preExisting }: { damage: DamageView; preExisting?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs ' +
        (preExisting ? 'border-dashed border-muted text-muted' : 'border-solid border-accent-600 text-foreground')
      }
    >
      {preExisting ? <History size={12} aria-hidden /> : <AlertTriangle size={12} aria-hidden />}
      {damage.panel.replace(/_/g, ' ')} · {t(`agreements.severity_${damage.severity}`)}
      {damage.chargeable && damage.chargeAmount && (
        <span className="ms-1 font-mono">
          <Money value={damage.chargeAmount} />
        </span>
      )}
    </span>
  );
}

export function DamageList({ preExisting, neu }: { preExisting: DamageView[]; neu: DamageView[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-muted">{t('agreements.preExisting')}</p>
        {preExisting.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {preExisting.map((d) => (
              <DamageBadge key={d.id} damage={d} preExisting />
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-muted">{t('agreements.newDamage')}</p>
        {neu.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {neu.map((d) => (
              <DamageBadge key={d.id} damage={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

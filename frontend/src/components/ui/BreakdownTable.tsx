import { useTranslation } from 'react-i18next';
import type { PricingBreakdown } from '@hosni/shared';
import { Money } from './Money';

/**
 * Renders a server-computed pricing breakdown line by line, in a form that can
 * be read aloud to a customer. It only displays values the server calculated.
 */
export function BreakdownTable({ breakdown, currency }: { breakdown: PricingBreakdown; currency?: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-sm">
        <tbody>
          {breakdown.lines.map((line, i) => (
            <tr key={i} className="border-b border-border">
              <td className="px-3 py-2">
                {t(line.labelKey)}
                {line.quantity > 1 && (
                  <span className="ms-1 text-xs text-muted">
                    ×{line.quantity} @ <Money value={line.unitAmount} currency={currency} />
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-end">
                <Money value={line.amount} currency={currency} />
              </td>
            </tr>
          ))}
          <tr className="border-b border-border">
            <td className="px-3 py-2 font-medium">{t('reservations.total')}</td>
            <td className="px-3 py-2 text-end font-semibold">
              <Money value={breakdown.total} currency={currency} />
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-muted">{t('reservations.deposit')}</td>
            <td className="px-3 py-2 text-end text-muted">
              <Money value={breakdown.deposit} currency={currency} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

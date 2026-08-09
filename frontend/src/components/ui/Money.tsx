import { useTranslation } from 'react-i18next';

/**
 * Formats a server-computed money string for display. It FORMATS ONLY and never
 * calculates — every amount is computed on the server (§6). The value arrives as
 * a decimal string; we render it with the organisation's currency and grouping.
 */
export function Money({ value, currency = 'USD' }: { value: string; currency?: string }) {
  const { i18n } = useTranslation();
  const n = Number(value);
  const text = Number.isFinite(n)
    ? new Intl.NumberFormat(i18n.language === 'so' ? 'so-SO' : 'en-US', {
        style: 'currency',
        currency,
      }).format(n)
    : value;
  return <span className="font-mono tabular">{text}</span>;
}

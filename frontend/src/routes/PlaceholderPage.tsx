import { useTranslation } from 'react-i18next';

/** Nav destination for a module not yet built. Keeps navigation stable. */
export default function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">{t(titleKey)}</h1>
      <div className="mt-4 rounded-md border border-border bg-surface p-8 text-center text-sm text-muted shadow-card">
        {t('common.comingSoon')}
      </div>
    </div>
  );
}

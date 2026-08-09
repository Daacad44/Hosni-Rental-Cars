import { useTranslation } from 'react-i18next';
import { setLocale, type AppLocale } from '../i18n';

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = i18n.language === 'en' ? 'en' : 'so';

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={current}
        onChange={(e) => setLocale(e.target.value as AppLocale)}
        className="min-h-[44px] rounded-sm border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
      >
        <option value="so">{t('common.somali')}</option>
        <option value="en">{t('common.english')}</option>
      </select>
    </label>
  );
}

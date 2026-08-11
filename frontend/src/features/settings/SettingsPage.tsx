import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RateCardsPage from './RateCardsPage';
import OrgSettingsPage from './OrgSettingsPage';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'rateCards' | 'organization'>('rateCards');

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('settings.title')}</h1>
      <div className="mb-4 flex gap-1 border-b border-border">
        {(['rateCards', 'organization'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-current={tab === k ? 'page' : undefined}
            className={'min-h-[44px] px-3 text-sm font-medium ' + (tab === k ? 'border-b-2 border-accent text-foreground' : 'text-muted')}
          >
            {t(k === 'rateCards' ? 'settings.tabRateCards' : 'settings.tabOrganization')}
          </button>
        ))}
      </div>
      {tab === 'rateCards' ? <RateCardsPage /> : <OrgSettingsPage />}
    </div>
  );
}

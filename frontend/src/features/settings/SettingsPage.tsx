import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OrganizationSettings from './OrganizationSettings';
import RateCardsPage from './RateCardsPage';

type Tab = 'organization' | 'rateCards';

/** Settings hub (OWNER-only route). Organization settings (§15) and rate cards. */
export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('organization');
  const tabs: Tab[] = ['organization', 'rateCards'];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('settings.title')}</h1>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-current={tab === k ? 'page' : undefined}
            className={
              'min-h-[44px] px-3 text-sm font-medium ' +
              (tab === k ? 'border-b-2 border-accent text-foreground' : 'text-muted hover:text-foreground')
            }
          >
            {t(`settings.tab${k === 'organization' ? 'Organization' : 'RateCards'}`)}
          </button>
        ))}
      </div>
      {tab === 'organization' ? <OrganizationSettings /> : <RateCardsPage />}
    </div>
  );
}

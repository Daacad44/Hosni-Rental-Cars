import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';
import so from './locales/so/common.json';

export const SUPPORTED_LOCALES = ['so', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = 'hosni.locale';

function initialLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'en' || stored === 'so' ? stored : 'so';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    so: { common: so },
  },
  lng: initialLocale(),
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export function setLocale(locale: AppLocale): void {
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  void i18n.changeLanguage(locale);
}

document.documentElement.lang = i18n.language;

export default i18n;

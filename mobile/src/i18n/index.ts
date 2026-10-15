import i18n from './instance';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import ptBR from './locales/pt-BR';
import en from './locales/en';

export const SUPPORTED_LOCALES = ['pt-BR', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'pt-BR';

/** pt-BR é o padrão; só usa inglês quando o aparelho está em inglês. */
export function resolveLocale(languageCodes: readonly (string | null | undefined)[]): AppLocale {
  const first = languageCodes.find((code): code is string => !!code);
  return first?.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}

function deviceLocale(): AppLocale {
  try {
    return resolveLocale(getLocales().map((l) => l.languageCode));
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Recursos embarcados, inicialização síncrona: nada de i18n espera rede ou disco.
void i18n.use(initReactI18next).init({
  resources: { 'pt-BR': { translation: ptBR }, en: { translation: en } },
  lng: deviceLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

export default i18n;
export * from './format';

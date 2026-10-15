import 'i18next';
import type { Translations } from './locales/pt-BR';

// Chaves de tradução tipadas: t('tabs.train') é checado pelo TypeScript.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translations };
  }
}

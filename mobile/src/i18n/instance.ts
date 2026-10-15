import { createInstance } from 'i18next';

// Instância própria do app (não a global do i18next): inicializada em ./index.ts.
const i18n = createInstance();

export default i18n;

import { useTranslation } from 'react-i18next';
import { PlaceholderScreen } from './PlaceholderScreen';

export function ProgressScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.progress')} message={t('progress.placeholder')} />;
}

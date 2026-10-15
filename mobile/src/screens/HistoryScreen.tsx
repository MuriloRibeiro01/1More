import { useTranslation } from 'react-i18next';
import { PlaceholderScreen } from './PlaceholderScreen';

export function HistoryScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.history')} message={t('history.placeholder')} />;
}

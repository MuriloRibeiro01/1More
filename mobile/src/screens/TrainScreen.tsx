import { useTranslation } from 'react-i18next';
import { formatKickerDate } from '../i18n';
import { PlaceholderScreen } from './PlaceholderScreen';

export function TrainScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.train')} kicker={formatKickerDate(new Date())} message={t('train.placeholder')} />;
}

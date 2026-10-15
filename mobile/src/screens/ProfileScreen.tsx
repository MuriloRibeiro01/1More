import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components';
import { space, text, useTheme, type ThemePreference } from '../theme';
import { PlaceholderScreen } from './PlaceholderScreen';

const THEME_OPTIONS = [
  { value: 'system', labelKey: 'profile.themeSystem' },
  { value: 'light', labelKey: 'profile.themeLight' },
  { value: 'dark', labelKey: 'profile.themeDark' },
] as const satisfies readonly { value: ThemePreference; labelKey: string }[];

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors: c, preference, setPreference } = useTheme();

  return (
    <PlaceholderScreen title={t('tabs.profile')} message={t('profile.placeholder')}>
      {/* Provisório até o SegmentedControl (passo 4 do Guia RN): a opção ativa é o único primary da tela. */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: c.inkMuted }]}>{t('profile.theme')}</Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <Button
                key={option.value}
                variant={selected ? 'primary' : 'secondary'}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setPreference(option.value)}
              >
                {t(option.labelKey)}
              </Button>
            );
          })}
        </View>
      </View>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.s2 },
  label: { ...text.label },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
});

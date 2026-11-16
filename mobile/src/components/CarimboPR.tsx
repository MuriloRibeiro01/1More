import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { border, radius, space, text, useTheme } from '../theme';

/** Carimbo "PR" laranja na margem: recorde pessoal. Só para séries válidas (não aquecimento). */
export function CarimboPR() {
  const { t } = useTranslation();
  const { colors: c } = useTheme();

  return (
    <View accessible accessibilityLabel={t('pr.label')} style={[styles.root, { borderColor: c.hugger }]}>
      <Text style={[styles.label, { color: c.hugger }]}>PR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: border.borderPen, borderRadius: radius.radius1, paddingHorizontal: space.s1 },
  label: { ...text.label },
});

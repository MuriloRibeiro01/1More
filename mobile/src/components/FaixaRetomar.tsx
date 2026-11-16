import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { size, space, text, useTheme } from '../theme';
import { Icon } from './Icon';

export interface FaixaRetomarProps {
  /** Parado há mais de 4 h (RN-04): vira "Esqueceu de finalizar?". */
  forgotten?: boolean;
  onPress: () => void;
}

/** Faixa amarela do treino ativo, visível em qualquer aba: volta ao treino com 1 toque. */
export function FaixaRetomar({ forgotten = false, onPress }: FaixaRetomarProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const label = t(forgotten ? 'train.forgot' : 'train.resume');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.stripe }}
      style={[styles.root, { backgroundColor: c.stripeWash }]}
    >
      <Icon name="play" size={size.sizeIconSm} color={c.ink} />
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: size.sizeTouch, flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingHorizontal: space.s4 },
  label: { ...text.bodyStrong, flex: 1 },
});

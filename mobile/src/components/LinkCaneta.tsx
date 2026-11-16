import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { size, space, text, useTheme } from '../theme';

export interface LinkCanetaProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  /** perigo = grifo laranja, para ação destrutiva. */
  tom?: 'normal' | 'perigo';
}

/** Ação secundária: texto sublinhado à caneta, sem caixa. O botão cheio é um só por tela. */
export function LinkCaneta({ children, tom = 'normal', disabled, accessibilityState, ...rest }: LinkCanetaProps) {
  const { colors: c } = useTheme();
  const cor = disabled ? c.inkFaint : tom === 'perigo' ? c.hugger : c.link;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      style={styles.root}
      {...rest}
    >
      <Text style={[styles.label, { color: cor }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: size.sizeTouch, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: space.s1 },
  label: { ...text.bodyStrong, textDecorationLine: 'underline' },
});

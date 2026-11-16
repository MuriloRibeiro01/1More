import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { border, size, space, useTheme } from '../theme';

export interface LinhaProps extends Omit<PressableProps, 'children' | 'style'> {
  children?: ReactNode;
  /** Coluna de 44px: número da série, letra da rotina, data, Caixinha, CarimboPR. */
  margem?: ReactNode;
  /** Série da vez: faixa amarela atravessando a linha. */
  destaque?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Linha de dado: desenha o próprio sublinhado de 1px, de borda a borda. Com `onPress` é tocável (56px, duas pautas). */
export function Linha({ children, margem, destaque = false, onPress, style, ...rest }: LinhaProps) {
  const { colors: c } = useTheme();
  const base = [
    styles.root,
    { minHeight: onPress ? size.sizeRow : size.sizeRule, borderBottomColor: c.rule },
    destaque && { backgroundColor: c.stripeWash },
    style,
  ];
  const conteudo = (
    <>
      <View style={styles.margem}>{margem}</View>
      <View style={styles.conteudo}>{children}</View>
    </>
  );

  if (!onPress) return <View style={base}>{conteudo}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{ color: c.paperSunk }} style={base} {...rest}>
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: border.borderHair },
  margem: { width: size.sizeMargin, alignItems: 'center', justifyContent: 'center' },
  // Texto apoiado na pauta de baixo; o respiro à esquerda mantém o texto fora da linha de margem (2px).
  conteudo: { flex: 1, justifyContent: 'flex-end', paddingLeft: space.s3, paddingRight: space.s4, paddingBottom: space.s1 },
});

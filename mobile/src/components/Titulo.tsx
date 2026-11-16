import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { border, text, useTheme } from '../theme';

export interface TituloProps {
  children: ReactNode;
  /** lg = título de tela | md = seção | compact = 24px, até 2 linhas (treino ativo). */
  tamanho?: 'lg' | 'md' | 'compact';
  /** secao = grifo laranja (hugger) de 3px | exercicio = régua de tinta de 2px. */
  variante?: 'secao' | 'exercicio';
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
}

/** Racing Sans One em caixa alta, grifado: o sublinhado acompanha a largura do texto. */
export function Titulo({ children, tamanho = 'lg', variante = 'secao', numberOfLines = tamanho === 'compact' ? 2 : 1, style }: TituloProps) {
  const { colors: c } = useTheme();
  const regua = variante === 'exercicio' ? { height: border.borderPen, backgroundColor: c.ink } : { height: 3, backgroundColor: c.hugger };

  return (
    <View style={[styles.root, style]}>
      <Text accessibilityRole="header" numberOfLines={numberOfLines} style={[estilos[tamanho], { color: c.ink }]}>
        {children}
      </Text>
      <View testID="titulo-grifo" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={regua} />
    </View>
  );
}

const estilos = StyleSheet.create({
  lg: { ...text.titleLg },
  md: { ...text.titleMd },
  compact: { ...text.titleLg, fontSize: 24, lineHeight: 28 },
});
const styles = StyleSheet.create({ root: { alignSelf: 'flex-start', maxWidth: '100%' } });

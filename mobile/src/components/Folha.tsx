import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { size, useTheme } from '../theme';

export interface FolhaProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Folha do caderno: fundo papel e só a linha de margem fixa a 44px. A pauta é de cada Linha, nunca do fundo. */
export function Folha({ children, style }: FolhaProps) {
  const { colors: c } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: c.paper }, style]}>
      <View
        testID="folha-margem"
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.margem, { backgroundColor: c.marginLine }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  margem: { position: 'absolute', top: 0, bottom: 0, left: size.sizeMargin, width: 2 },
});

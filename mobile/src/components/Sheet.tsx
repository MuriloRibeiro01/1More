import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { border, radius, space, text, useTheme } from '../theme';

export interface SheetProps {
  open?: boolean;
  /** Só para documentação: desenha a folha no fluxo, sem modal. */
  inline?: boolean;
  title?: string;
  onClose?: () => void;
  /** Botões `block`, no máximo 4; destrutivo por último. */
  children?: ReactNode;
}

/** Folha que sobe de baixo para escolhas e confirmações. Nunca diálogo central. */
export function Sheet({ open = false, inline = false, title, onClose, children }: SheetProps) {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();

  const panel = (
    <View
      accessibilityViewIsModal={!inline}
      style={[
        styles.panel,
        { backgroundColor: c.paperRaised, borderColor: c.line, paddingBottom: space.s4 + insets.bottom },
      ]}
    >
      {title ? (
        <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>
          {title}
        </Text>
      ) : null}
      <View style={styles.actions}>{children}</View>
    </View>
  );

  if (inline) return panel;

  return (
    <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Véu: tocar fora fecha. Fica fora da árvore de acessibilidade (o voltar do sistema fecha). */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        {panel}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    paddingHorizontal: space.s4,
    paddingTop: space.s5,
    gap: space.s4,
    borderTopLeftRadius: radius.radius2,
    borderTopRightRadius: radius.radius2,
    borderTopWidth: border.borderHair,
  },
  title: { ...text.titleMd },
  actions: { gap: space.s2 },
});

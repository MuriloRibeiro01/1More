import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { border, space, text, useTheme } from '../theme';

export interface EmptyStateProps {
  title: string;
  body?: string;
  /** Um Button. */
  action?: ReactNode;
}

/** Página em branco do caderno: título com sublinhado duplo, uma frase direta e uma ação. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  const { colors: c } = useTheme();

  return (
    <View style={styles.root}>
      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>
          {title}
        </Text>
        <View style={styles.underline} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.rule, { backgroundColor: c.ink }]} />
          <View style={[styles.rule, { backgroundColor: c.ink }]} />
        </View>
      </View>
      {body ? <Text style={[styles.body, { color: c.inkMuted }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: space.s7, gap: space.s4, alignItems: 'flex-start' },
  titleBlock: { alignSelf: 'stretch', gap: space.s2 },
  title: { ...text.titleLg },
  underline: { gap: border.borderPen },
  rule: { height: border.borderHair },
  body: { ...text.bodyLg },
});

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { space, text, useTheme } from '../theme';
import { Titulo } from './Titulo';

export interface EmptyStateProps {
  title: string;
  body?: string;
  /** Um Button. */
  action?: ReactNode;
}

/** Página em branco do caderno: título grifado, uma frase direta e uma ação. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  const { colors: c } = useTheme();

  return (
    <View style={styles.root}>
      <Titulo>{title}</Titulo>
      {body ? <Text style={[styles.body, { color: c.inkMuted }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: space.s7, gap: space.s4, alignItems: 'flex-start' },
  body: { ...text.bodyLg },
});

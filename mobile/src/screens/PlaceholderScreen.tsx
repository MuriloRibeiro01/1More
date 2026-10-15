import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../components';
import { space, text, useTheme } from '../theme';

interface PlaceholderScreenProps {
  title: string;
  kicker?: ReactNode;
  message: string;
  children?: ReactNode;
}

/** Esqueleto comum das abas na fundação: TopBar + texto direto. Some quando cada tela for implementada. */
export function PlaceholderScreen({ title, kicker, message, children }: PlaceholderScreenProps) {
  const { colors: c } = useTheme();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.paper }]}>
      <TopBar title={title} kicker={kicker} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.message, { color: c.inkMuted }]}>{message}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: space.s4,
    paddingTop: space.s5,
    paddingBottom: space.s8,
    gap: space.s6,
  },
  message: { ...text.bodyLg },
});

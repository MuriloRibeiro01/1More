import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { space, text, useTheme } from '../theme';
import { Titulo } from './Titulo';

export interface TopBarProps {
  title: ReactNode;
  /** Linha de contexto em mono acima do título (data, rotina). */
  kicker?: ReactNode;
  /** Título de 24px em até 2 linhas — para o treino ativo. */
  compact?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function TopBar({ title, kicker, compact = false, left, right, style }: TopBarProps) {
  const { colors: c } = useTheme();

  return (
    <View style={[styles.root, style]}>
      <View style={styles.row}>
        {left ? <View style={styles.side}>{left}</View> : null}
        <View style={styles.center}>
          {kicker != null ? (
            <Text style={[styles.kicker, { color: c.inkMuted }]} numberOfLines={1}>
              {kicker}
            </Text>
          ) : null}
          <Titulo tamanho={compact ? 'compact' : 'lg'}>{title}</Titulo>
        </View>
        {right ? <View style={styles.side}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.s2,
  },
  side: { justifyContent: 'center' },
  center: { flex: 1, paddingBottom: space.s2 },
  kicker: { ...text.numSm },
});

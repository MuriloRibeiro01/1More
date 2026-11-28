import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { size, space, text, useTheme } from '../theme';

export interface FaixaFiltrosProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** Rótulo falado do grupo. */
  label?: string;
}

/** Filtros escritos em linha rolável ("Todos · Peito · Costas…"): o sublinhado laranja marca o ativo. Sem pílula. */
export function FaixaFiltros<T extends string>({ options, value, onChange, label }: FaixaFiltrosProps<T>) {
  const { colors: c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.id)}
            android_ripple={{ color: c.paperSunk }}
            style={styles.option}
          >
            <Text style={[styles.label, { color: selected ? c.ink : c.inkMuted }]}>{o.label}</Text>
            <View style={[styles.bar, { backgroundColor: selected ? c.hugger : 'transparent' }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.s4, gap: space.s4 },
  option: { minHeight: size.sizeTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  label: { ...text.bodyStrong },
  bar: { height: 3, marginTop: space.s1 },
});

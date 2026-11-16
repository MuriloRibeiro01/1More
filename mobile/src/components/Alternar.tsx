import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size, space, text, useTheme } from '../theme';

export interface AlternarProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** Rótulo falado do grupo. */
  label?: string;
}

/** Alternância escrita (Lista | Mês): o sublinhado laranja marca a opção ativa. Sem pílula nem caixa. */
export function Alternar<T extends string>({ options, value, onChange, label }: AlternarProps<T>) {
  const { colors: c } = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.root}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: space.s4 },
  option: { minHeight: size.sizeTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  label: { ...text.bodyStrong },
  bar: { height: 3, marginTop: space.s1 },
});

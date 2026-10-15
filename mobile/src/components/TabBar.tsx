import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { border, size as sizes, space, text, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

export interface TabBarItem {
  id: string;
  label: string;
  icon: IconName;
}

export interface TabBarProps {
  items: TabBarItem[];
  active: string;
  onChange?: (id: string) => void;
}

/** Navegação principal fixa: 4 abas, ordem e nomes não mudam (RNF-08). */
export function TabBar({ items, active, onChange }: TabBarProps) {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.root,
        { backgroundColor: c.paperRaised, borderTopColor: c.line, paddingBottom: insets.bottom },
      ]}
    >
      {items.map((item) => {
        const selected = item.id === active;
        const fg = selected ? c.ink : c.inkMuted;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onChange?.(item.id)}
            android_ripple={{ color: c.paperSunk }}
            style={({ pressed }) => [styles.tab, pressed && { backgroundColor: c.paperSunk }]}
          >
            {/* Aba ativa: barra de tinta no topo. */}
            <View style={[styles.indicator, { backgroundColor: selected ? c.ink : 'transparent' }]} />
            <Icon name={item.icon} size={sizes.sizeIcon} color={fg} />
            <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderTopWidth: border.borderHair,
  },
  tab: {
    flex: 1,
    minHeight: sizes.sizeTabbar,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: space.s2,
    right: space.s2,
    height: border.borderDouble,
  },
  label: { ...text.label },
});

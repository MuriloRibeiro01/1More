import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { border, size as sizes, space, text, useTheme } from '../theme';

export interface NumberFieldProps {
  value?: string | number;
  onChange?: (value: string) => void;
  /** Valor anterior, a lápis. */
  placeholder?: string;
  label?: string;
  hideLabel?: boolean;
  ariaLabel?: string;
  unit?: string;
  /** md dentro da SetRow | lg em formulários. */
  size?: 'md' | 'lg';
  /** false para reps (teclado numérico). */
  decimal?: boolean;
  disabled?: boolean;
  /** Valor a lápis (ink-muted): sugestão ainda não confirmada. */
  muted?: boolean;
  /** Ao sair do campo (gravar sem esperar o próximo toque). */
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Campo numérico "na linha": sem caixa, só o sublinhado de 2px, dígitos em mono. */
export function NumberField({
  value,
  onChange,
  placeholder,
  label,
  hideLabel = false,
  ariaLabel,
  unit,
  size = 'lg',
  decimal = true,
  disabled = false,
  muted = false,
  onBlur,
  style,
}: NumberFieldProps) {
  const { colors: c } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.root, style]}>
      {label && !hideLabel ? <Text style={[styles.label, { color: c.inkMuted }]}>{label}</Text> : null}
      <View
        style={[
          styles.line,
          { borderBottomColor: focused ? c.focus : c.lineStrong, backgroundColor: focused ? c.paperSunk : 'transparent' },
        ]}
      >
        <TextInput
          accessibilityLabel={ariaLabel ?? label}
          accessibilityState={{ disabled }}
          editable={!disabled}
          value={value === undefined ? undefined : String(value)}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.inkMuted}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={[size === 'lg' ? styles.inputLg : styles.inputMd, { color: disabled ? c.inkFaint : muted ? c.inkMuted : c.ink }]}
        />
        {unit ? <Text style={[styles.unit, { color: c.inkMuted }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.s1 },
  label: { ...text.label },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.sizeTouch,
    borderBottomWidth: border.borderPen,
    gap: space.s1,
  },
  inputLg: { ...text.numLg, flex: 1, paddingVertical: 0 },
  inputMd: { ...text.numMd, flex: 1, paddingVertical: 0 },
  unit: { ...text.numSm },
});

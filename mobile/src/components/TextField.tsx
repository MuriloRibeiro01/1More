import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { border, size as sizes, space, text, useTheme } from '../theme';

export interface TextFieldProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Dica sob o campo. */
  hint?: string;
  multiline?: boolean;
  rows?: number;
  /** No web é o `type` do input; aqui escolhe o teclado. */
  type?: TextInputProps['keyboardType'];
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
}

/** Campo de texto sublinhado, com rótulo em caixa alta acima (nunca só placeholder). */
export function TextField({ label, value, onChange, placeholder, hint, multiline = false, rows = 3, type, maxLength, style }: TextFieldProps) {
  const { colors: c } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.root, style]}>
      {label ? <Text style={[styles.label, { color: c.inkMuted }]}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.inkMuted}
        keyboardType={type}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? rows : 1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && { minHeight: rows * sizes.sizeRule, textAlignVertical: 'top' },
          {
            color: c.ink,
            borderBottomColor: focused ? c.focus : c.lineStrong,
            backgroundColor: focused ? c.paperSunk : 'transparent',
          },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: c.inkMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.s1 },
  label: { ...text.label },
  input: {
    ...text.bodyLg,
    minHeight: sizes.sizeTouch,
    borderBottomWidth: border.borderPen,
    paddingVertical: space.s2,
  },
  hint: { ...text.caption },
});

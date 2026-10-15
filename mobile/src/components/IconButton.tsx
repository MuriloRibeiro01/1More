import { useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { border, radius, size as sizes, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

/**
 * Mesmas props do Design System; `onClick` do web vira `onPress`.
 * `size` é o lado da área de toque e nunca fica abaixo de 48 (size-touch).
 */
export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  /** Obrigatório: vira o accessibilityLabel. */
  label: string;
  variant?: 'ghost' | 'outline';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size,
  disabled,
  accessibilityState,
  style,
  onFocus,
  onBlur,
  ...rest
}: IconButtonProps) {
  const { colors: c } = useTheme();
  const [focused, setFocused] = useState(false);
  const side = Math.max(size ?? sizes.sizeTouch, sizes.sizeTouch);
  const restBorder = variant === 'outline' ? c.lineStrong : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      android_ripple={{ color: c.paperSunk, borderless: false }}
      style={({ pressed }) => [
        styles.base,
        {
          width: side,
          height: side,
          backgroundColor: pressed ? c.paperSunk : 'transparent',
          borderColor: focused ? c.focus : restBorder,
        },
        style,
      ]}
      {...rest}
    >
      <Icon name={icon} size={sizes.sizeIcon} color={disabled ? c.inkFaint : c.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.borderPen,
    borderRadius: radius.radius1,
  },
});

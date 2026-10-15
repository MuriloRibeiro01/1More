import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { border, radius, size as sizes, space, text, useTheme, type ThemeColors } from '../theme';
import { Icon, type IconName } from './Icon';

/**
 * Mesmas props do Design System. O que no web vem de ButtonHTMLAttributes
 * vem aqui de PressableProps: `onClick` → `onPress`, `disabled` igual.
 */
export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  /** primary = tinta cheia, uma por tela. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** md = 48px, lg = 56px. */
  size?: 'md' | 'lg';
  block?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  style?: StyleProp<ViewStyle>;
}

interface VariantColors {
  bg: string;
  pressedBg: string;
  border: string;
  fg: string;
}

function variantColors(c: ThemeColors, variant: NonNullable<ButtonProps['variant']>): VariantColors {
  switch (variant) {
    case 'primary':
      return { bg: c.ink, pressedBg: c.inkMuted, border: c.ink, fg: c.onInk };
    case 'secondary':
      return { bg: 'transparent', pressedBg: c.paperSunk, border: c.ink, fg: c.ink };
    case 'ghost':
      return { bg: 'transparent', pressedBg: c.paperSunk, border: 'transparent', fg: c.ink };
    case 'danger':
      return { bg: 'transparent', pressedBg: c.paperSunk, border: c.hugger, fg: c.hugger };
  }
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  iconRight,
  disabled,
  accessibilityState,
  style,
  onFocus,
  onBlur,
  ...rest
}: ButtonProps) {
  const { colors: c } = useTheme();
  const [focused, setFocused] = useState(false);
  const v = variantColors(c, variant);
  const fg = disabled ? c.inkFaint : v.fg;
  const iconSize = size === 'lg' ? sizes.sizeIcon : sizes.sizeIconSm;

  return (
    <Pressable
      accessibilityRole="button"
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
      android_ripple={{ color: c.paperSunk }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: size === 'lg' ? sizes.sizeRow : sizes.sizeTouch },
        block && styles.block,
        {
          backgroundColor: disabled ? c.paperSunk : pressed ? v.pressedBg : v.bg,
          borderColor: focused ? c.focus : disabled ? c.inkFaint : v.border,
        },
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={iconSize} color={fg} /> : null}
        <Text style={[styles.label, { color: fg }]}>{children}</Text>
        {iconRight ? <Icon name={iconRight} size={iconSize} color={fg} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: space.s5,
    borderWidth: border.borderPen,
    borderRadius: radius.radius1,
  },
  block: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
  },
  label: { ...text.button, textAlign: 'center' },
});

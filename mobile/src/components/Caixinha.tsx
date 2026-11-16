import { Pressable, StyleSheet, View } from 'react-native';
import { border, radius, size, useTheme } from '../theme';
import { Icon } from './Icon';

export interface CaixinhaProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** Obrigatório: a caixinha não tem texto próprio ("Série 2", "Supino reto"). */
  label: string;
  disabled?: boolean;
}

/** Caixinha de check azul (Grabber) na margem: série concluída, item selecionado. Área de toque de 48dp. */
export function Caixinha({ checked, onChange, label, disabled = false }: CaixinhaProps) {
  const { colors: c } = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange?.(!checked)}
      style={styles.alvo}
    >
      <View
        style={[
          styles.caixa,
          { borderColor: disabled ? c.inkFaint : c.grabber, backgroundColor: checked ? (disabled ? c.inkFaint : c.grabber) : 'transparent' },
        ]}
      >
        {checked ? <Icon name="check" size={size.sizeIconSm} color={c.onGrabber} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alvo: { minWidth: size.sizeTouch, minHeight: size.sizeTouch, alignItems: 'center', justifyContent: 'center' },
  caixa: {
    width: size.sizeIcon + 2,
    height: size.sizeIcon + 2,
    borderWidth: border.borderPen,
    borderRadius: radius.radius1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

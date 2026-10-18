import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space, text, useTheme } from '../theme';
import { IconButton } from './IconButton';

export interface StepperProps {
  label?: string;
  value: number;
  onChange?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Ex.: segundos → "1:30". */
  format?: (value: number) => string;
}

/** Valor numérico ajustado por botões −/+ de 48px. O valor é `adjustable` para o leitor de tela. */
export function Stepper({ label = '', value, onChange, step = 1, min = -Infinity, max = Infinity, unit, format }: StepperProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const shown = format ? format(value) : String(value);
  const spoken = unit ? `${shown} ${unit}` : shown;
  const name = label.toLocaleLowerCase();
  const canDecrease = value - step >= min;
  const canIncrease = value + step <= max;
  const change = (delta: number) => onChange?.(Math.min(max, Math.max(min, value + delta)));

  return (
    <View style={styles.root}>
      {label ? <Text style={[styles.label, { color: c.inkMuted }]}>{label}</Text> : null}
      <View style={styles.row}>
        <IconButton
          icon="minus"
          variant="outline"
          label={t('stepper.decrease', { label: name })}
          disabled={!canDecrease}
          onPress={() => change(-step)}
        />
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: spoken }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment' && canIncrease) change(step);
            if (e.nativeEvent.actionName === 'decrement' && canDecrease) change(-step);
          }}
          style={styles.value}
        >
          <Text style={[styles.number, { color: c.ink }]}>{shown}</Text>
          {unit ? <Text style={[styles.unit, { color: c.inkMuted }]}>{unit}</Text> : null}
        </View>
        <IconButton
          icon="plus"
          variant="outline"
          label={t('stepper.increase', { label: name })}
          disabled={!canIncrease}
          onPress={() => change(step)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.s1 },
  label: { ...text.label },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  value: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.s1, minWidth: 72 },
  number: { ...text.numLg, textAlign: 'center' },
  unit: { ...text.numSm },
});

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, TextField, TopBar } from '../components';
import type { CustomExerciseValues, TrackingType } from '../routines/customExercise';
import { size, space, text, useTheme } from '../theme';

export const MUSCLE_KEYS = [
  'chest', 'upper_back', 'lower_back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'forearms', 'calves', 'abs', 'traps',
] as const;
export const EQUIPMENT_KEYS = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'] as const;

interface Props {
  initial?: CustomExerciseValues;
  /** Texto do aviso (nome vazio/repetido, falha); null = sem aviso. */
  error: string | null;
  onSave: (values: CustomExerciseValues) => void;
  onCancel: () => void;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors: c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={styles.choice}>
      <Text style={[styles.choiceLabel, { color: selected ? c.ink : c.inkMuted }]}>{label}</Text>
      <View style={[styles.bar, { backgroundColor: selected ? c.hugger : 'transparent' }]} />
    </Pressable>
  );
}

/** Formulário de exercício próprio (RF-12/RF-13): nome, músculo, equipamento e tipo de registro. */
export function ExerciseFormView({ initial, error, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [muscle, setMuscle] = useState<string | null>(initial?.primaryMuscle ?? null);
  const [equipment, setEquipment] = useState<string | null>(initial?.equipmentCode ?? null);
  // Só carga e repetições por enquanto: a tela de treino ainda não registra tempo nem só repetições (BACKLOG R-14).
  const tracking: TrackingType = initial?.trackingType ?? 'weight_reps';
  const editing = initial !== undefined;

  return (
    <View testID="exercicio-form" style={styles.root}>
      <TopBar
        title={editing ? t('picker.form.editTitle') : t('picker.form.newTitle')}
        compact
        left={<IconButton icon="chevron-left" label={t('picker.back')} onPress={onCancel} />}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label={t('picker.form.name')} value={name} onChange={setName} maxLength={80} />
        <Text style={[styles.group, { color: c.inkMuted }]}>{t('picker.form.muscle')}</Text>
        <View style={styles.wrap}>
          {MUSCLE_KEYS.map((k) => (
            <Choice key={k} label={t(`progress.muscles.${k}`)} selected={muscle === k} onPress={() => setMuscle(muscle === k ? null : k)} />
          ))}
        </View>
        <Text style={[styles.group, { color: c.inkMuted }]}>{t('picker.form.equipment')}</Text>
        <View style={styles.wrap}>
          {EQUIPMENT_KEYS.map((k) => (
            <Choice key={k} label={t(`picker.equipment.${k}`)} selected={equipment === k} onPress={() => setEquipment(equipment === k ? null : k)} />
          ))}
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: c.ink }]}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          variant="primary"
          block
          onPress={() => onSave({ name, primaryMuscle: muscle, equipmentCode: equipment, trackingType: tracking })}
        >
          {t('picker.form.save')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.s4, gap: space.s3 },
  group: { ...text.label, paddingTop: space.s3 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s4 },
  choice: { minHeight: size.sizeTouch, minWidth: size.sizeTouch, justifyContent: 'center' },
  choiceLabel: { ...text.bodyStrong },
  bar: { height: 3, marginTop: space.s1 },
  error: { ...text.body, paddingTop: space.s2 },
  footer: { padding: space.s4 },
});

import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Button, CarimboPR, Folha, IconButton, Linha, LinkCaneta, LivroCaixa, NumberField, Sheet, Titulo, TopBar } from '../components';
import { formatKgInput, formatKickerDate, formatNumber, formatWeight } from '../i18n';
import { useFocusedBackHandler } from '../navigation/useFocusedBackHandler';
import { parseKg, parseReps } from '../routines/rules';
import {
  ActiveWorkoutError,
  addSet,
  discardWorkout,
  loadWorkout,
  removeExercise,
  removeSet,
  repeatWorkout,
  syncWorkoutEnd,
  updateSet,
  type SetSnapshot,
  type WorkoutSnapshot,
} from '../workout/repository';
import { formatDuration, loadSummary, type LoadedSummary } from '../workout/summary';
import { size, space, text, useTheme } from '../theme';

interface Props {
  workoutId: string;
  /** Abre já editável (treino recém-registrado). */
  edit?: boolean;
  /** Recém-registrado: se sair sem nenhuma série válida, o treino vazio é descartado. */
  isNew?: boolean;
}

type Confirm = null | 'delete' | { kind: 'set' | 'exercise'; id: string; label: string };

const MARGIN_LETTER = { warmup: 'A', drop: 'D', failure: 'F' } as const;

/** Uma série como no diário: "82,5×10"; tipo diferente de normal leva a letra na frente ("D 80×9"). */
function diaryEntry(s: SetSnapshot): string {
  const body = s.weightKg === null ? String(s.reps) : `${formatNumber(s.weightKg)}×${s.reps}`;
  return s.type === 'normal' ? body : `${MARGIN_LETTER[s.type]} ${body}`;
}

/** Treino passado: o que ficou anotado. "Editar" libera as linhas; PRs e volume recalculam (RN-11). */
export function WorkoutDetailScreen({ workoutId, edit = false, isNew = false }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const navigation = useNavigation<{
    goBack: () => void;
    navigate: (name: 'ExercisePicker', params: { workoutId: string }) => void;
    replace: (name: 'ActiveWorkout', params: { workoutId: string }) => void;
  }>();

  const [workout, setWorkout] = useState<WorkoutSnapshot | null>(null);
  const [summary, setSummary] = useState<LoadedSummary | null>(null);
  const [editing, setEditing] = useState(edit);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<null | 'activeExists' | 'failed'>(null);

  const refresh = useCallback(async () => {
    try {
      const [w, s] = await Promise.all([loadWorkout(db, workoutId), loadSummary(db, workoutId)]);
      setWorkout(w);
      setSummary(s);
    } catch (e) {
      console.error('[treino] falha ao abrir o treino passado', e);
      setError('failed');
    }
  }, [db, workoutId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const guard = async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (e) {
      console.error('[treino] falha ao gravar', e);
      setError('failed');
    }
  };

  const leave = useCallback(() => {
    // Treino recém-registrado que ficou sem nenhuma série não vira lixo no histórico.
    if (isNew && summary && summary.validSets === 0) {
      discardWorkout(db, workoutId)
        .catch((e) => console.error('[treino] falha ao descartar o treino vazio', e))
        .finally(navigation.goBack);
    } else {
      navigation.goBack();
    }
  }, [db, isNew, navigation, summary, workoutId]);
  useFocusedBackHandler(leave);

  if (!workout || !summary) return <SafeAreaView style={[styles.root, { backgroundColor: c.paper }]} />;

  // Série nova concluída dentro do intervalo do treino (nunca "agora", que cairia fora da data do treino).
  const completedAtForNew = Math.max(workout.endedAt ?? workout.startedAt, workout.startedAt) + 60_000;
  const recordOf = (exerciseId: string) => summary.records.some((r) => r.exerciseId === exerciseId);

  const saveValues = (set: SetSnapshot, values: { weightKg: number | null; reps: number }) =>
    guard(async () => {
      const done = set.completedAt !== null;
      await updateSet(db, set.id, done ? values : { ...values, completed: true }, completedAtForNew);
      await syncWorkoutEnd(db, workoutId);
      await refresh();
    });

  const doConfirm = () => {
    const target = confirm;
    setConfirm(null);
    if (!target) return;
    void guard(async () => {
      if (target === 'delete') {
        await discardWorkout(db, workoutId);
        navigation.goBack();
        return;
      }
      if (target.kind === 'set') await removeSet(db, target.id);
      else await removeExercise(db, target.id);
      await syncWorkoutEnd(db, workoutId);
      await refresh();
    });
  };

  const repeat = () =>
    guard(async () => {
      try {
        navigation.replace('ActiveWorkout', { workoutId: await repeatWorkout(db, workoutId) });
      } catch (e) {
        if (e instanceof ActiveWorkoutError) setError('activeExists');
        else throw e;
      }
    });

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar
          title={workout.name || t('workout.freeTitle')}
          kicker={formatKickerDate(new Date(workout.startedAt))}
          compact
          left={<IconButton icon="chevron-left" label={t('detail.back')} onPress={leave} />}
          right={<LinkCaneta onPress={() => setEditing((e) => !e)}>{editing ? t('detail.done') : t('detail.edit')}</LinkCaneta>}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <LivroCaixa rotulo={t('summary.duration')} valor={formatDuration(summary.durationMs)} />
          <LivroCaixa rotulo={t('summary.volume')} valor={formatWeight(summary.volumeKg)} />

          {workout.exercises.map((ex) => (
            <View key={ex.id} style={styles.exercise}>
              <Linha margem={recordOf(ex.exerciseId) ? <CarimboPR /> : undefined}>
                <View style={styles.exerciseHeader}>
                  <Titulo tamanho="md" variante="exercicio">
                    {ex.name}
                  </Titulo>
                  {editing ? (
                    <IconButton
                      icon="trash"
                      label={t('detail.removeExercise', { name: ex.name })}
                      onPress={() => setConfirm({ kind: 'exercise', id: ex.id, label: ex.name })}
                    />
                  ) : null}
                </View>
              </Linha>
              {editing ? (
                <>
                  {ex.sets.map((set, i) => (
                    <EditRow
                      key={set.id}
                      n={i + 1}
                      exerciseName={ex.name}
                      set={set}
                      onSave={(values) => saveValues(set, values)}
                      onRemove={() => setConfirm({ kind: 'set', id: set.id, label: ex.name })}
                    />
                  ))}
                  <View style={styles.gutter}>
                    <LinkCaneta
                      accessibilityLabel={`${t('workout.addSet')} ${ex.name}`}
                      onPress={() =>
                        guard(async () => {
                          await addSet(db, ex.id);
                          await refresh();
                        })
                      }
                    >
                      {t('workout.addSet')}
                    </LinkCaneta>
                  </View>
                </>
              ) : (
                <Linha>
                  <Text style={[styles.diary, { color: c.ink }]}>{ex.sets.filter((s) => s.completedAt !== null).map(diaryEntry).join(' · ')}</Text>
                </Linha>
              )}
            </View>
          ))}

          <View style={styles.gutter}>
            {editing ? (
              <LinkCaneta onPress={() => navigation.navigate('ExercisePicker', { workoutId })}>{t('workout.addExercise')}</LinkCaneta>
            ) : null}
            {summary.notes ? <Text style={[styles.note, { color: c.inkMuted }]}>{summary.notes}</Text> : null}
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: c.ink }]}>
                {t(error === 'activeExists' ? 'detail.activeExists' : 'detail.failed')}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, styles.gutter]}>
          <Button variant="primary" size="lg" icon="play" onPress={repeat}>
            {t('detail.repeat')}
          </Button>
          <LinkCaneta tom="perigo" onPress={() => setConfirm('delete')}>
            {t('detail.delete')}
          </LinkCaneta>
        </View>
      </Folha>

      <Sheet open={confirm === 'delete'} title={t('detail.deleteTitle')} onClose={() => setConfirm(null)}>
        <Button variant="danger" block onPress={doConfirm}>
          {t('detail.confirmDelete')}
        </Button>
        <Button block onPress={() => setConfirm(null)}>
          {t('detail.cancel')}
        </Button>
      </Sheet>
      <Sheet open={typeof confirm === 'object' && confirm !== null} title={t('detail.removeTitle')} onClose={() => setConfirm(null)}>
        <Button variant="danger" block onPress={doConfirm}>
          {t('detail.remove')}
        </Button>
        <Button block onPress={() => setConfirm(null)}>
          {t('detail.cancel')}
        </Button>
      </Sheet>
    </SafeAreaView>
  );
}

interface EditRowProps {
  n: number;
  exerciseName: string;
  set: SetSnapshot;
  onSave: (values: { weightKg: number | null; reps: number }) => void;
  onRemove: () => void;
}

function EditRow({ n, exerciseName, set, onSave, onRemove }: EditRowProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [weight, setWeight] = useState(formatKgInput(set.weightKg));
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps));

  const save = () => {
    const w = parseKg(weight);
    const r = parseReps(reps);
    if (!w.ok || typeof r !== 'number') return;
    // Grava só se mudou ou se a série ainda não estava concluída.
    if (set.completedAt === null || w.value !== set.weightKg || r !== set.reps) onSave({ weightKg: w.value, reps: r });
  };

  return (
    <Linha margem={<Text style={[styles.marginText, { color: c.ink }]}>{set.type === 'normal' ? n : MARGIN_LETTER[set.type]}</Text>}>
      <View style={styles.setRow}>
        <NumberField style={styles.flex} size="md" hideLabel unit="kg" value={weight} onChange={setWeight} onBlur={save} ariaLabel={t('workout.weightLabel', { n, name: exerciseName })} />
        <Text style={[styles.times, { color: c.inkMuted }]}>×</Text>
        <NumberField style={styles.flex} size="md" hideLabel decimal={false} value={reps} onChange={setReps} onBlur={save} ariaLabel={t('workout.repsLabel', { n, name: exerciseName })} />
        <IconButton icon="trash" label={t('detail.removeSet', { n, name: exerciseName })} onPress={onRemove} />
      </View>
    </Linha>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: space.s4, paddingBottom: space.s5 },
  // Texto livre fica à direita da linha de margem (44px + 2px).
  gutter: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  exercise: { paddingTop: space.s4 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diary: { ...text.numMd },
  marginText: { ...text.numMd },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  flex: { flex: 1 },
  times: { ...text.numMd },
  note: { ...text.body, paddingTop: space.s3 },
  error: { ...text.body, paddingTop: space.s2 },
  footer: { gap: space.s1, paddingTop: space.s3 },
});

import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Button, Caixinha, CarimboPR, Folha, IconButton, Linha, LinkCaneta, NumberField, Sheet, Titulo, TopBar } from '../components';
import { formatKgInput } from '../i18n';
import { formatRest, parseKg, parseReps } from '../routines/rules';
import {
  NothingToSaveError,
  PendingSetsError,
  addSet,
  discardWorkout,
  finishWorkout,
  loadWorkout,
  removeExercise,
  updateSet,
  validSetHistory,
  type SetSnapshot,
  type WorkoutExerciseSnapshot,
  type WorkoutSnapshot,
} from '../workout/repository';
import { useRestTimer } from '../workout/restTimer';
import { isForgotten, prsForSet } from '../workout/rules';
import type { SetLog } from '../workout/types';
import { size, space, text, useTheme } from '../theme';

type Sheets = null | 'empty' | 'pending' | 'forgot' | { removeId: string; name: string };

const MARGIN_LETTER = { warmup: 'A', drop: 'D', failure: 'F' } as const;
const lastActivity = (w: WorkoutSnapshot) =>
  Math.max(w.startedAt, ...w.exercises.flatMap((e) => e.sets.map((s) => s.completedAt ?? 0)));
const asLog = (s: SetSnapshot): SetLog => ({ type: s.type, weightKg: s.weightKg, reps: s.reps, completedAt: s.completedAt });

/** Treino ativo: a página do diário. Cada toque já grava no SQLite antes de a tela confirmar (RNF-02). */
export function ActiveWorkoutScreen({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const navigation = useNavigation<{
    goBack: () => void;
    navigate: (name: 'ExercisePicker', params: { workoutId: string }) => void;
    replace: (name: 'WorkoutSummary', params: { workoutId: string }) => void;
  }>();
  const timer = useRestTimer();

  const [workout, setWorkout] = useState<WorkoutSnapshot | null>(null);
  const [sheet, setSheet] = useState<Sheets>(null);
  const [prs, setPrs] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const askedForgot = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const loaded = await loadWorkout(db, workoutId);
      setWorkout(loaded);
      // RN-04: ao abrir um treino parado há mais de 4 h, oferece finalizar na hora da última série.
      if (!askedForgot.current && loaded.status === 'active') {
        askedForgot.current = true;
        if (isForgotten(lastActivity(loaded), Date.now())) setSheet('forgot');
      }
    } catch (error) {
      console.error('[treino] falha ao abrir o treino', error);
      setFailed(true);
    }
  }, [db, workoutId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const guard = async (action: () => Promise<void>) => {
    try {
      setFailed(false);
      await action();
    } catch (error) {
      console.error('[treino] falha ao gravar', error);
      setFailed(true);
    }
  };

  const finish = (pending?: 'complete' | 'discard') =>
    guard(async () => {
      try {
        await finishWorkout(db, workoutId, { pending });
        setSheet(null);
        navigation.replace('WorkoutSummary', { workoutId });
      } catch (error) {
        if (error instanceof NothingToSaveError) setSheet('empty');
        else if (error instanceof PendingSetsError) setSheet('pending');
        else throw error;
      }
    });

  const discard = () =>
    guard(async () => {
      await discardWorkout(db, workoutId);
      setSheet(null);
      navigation.goBack();
    });

  const complete = (ex: WorkoutExerciseSnapshot, set: SetSnapshot, values: { weightKg: number | null; reps: number }) =>
    guard(async () => {
      const now = Date.now();
      await updateSet(db, set.id, { ...values, completed: true }, now);
      timer.start(ex.restSeconds);
      const history = await validSetHistory(db, ex.exerciseId, workoutId);
      const earlier = ex.sets.filter((s) => s.id !== set.id && s.completedAt !== null).map(asLog);
      const candidate: SetLog = { type: set.type, ...values, completedAt: now };
      if (prsForSet(candidate, [...history, ...earlier]).length > 0) setPrs((p) => new Set(p).add(set.id));
      await refresh();
    });

  const edit = (setId: string, patch: { weightKg?: number | null; reps?: number; completed?: boolean }) =>
    guard(async () => {
      await updateSet(db, setId, patch);
      await refresh();
    });

  if (!workout) return <SafeAreaView style={[styles.root, { backgroundColor: c.paper }]} />;

  const title = workout.name || t('workout.freeTitle');
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar title={title} compact left={<IconButton icon="chevron-down" label={t('workout.minimize')} onPress={navigation.goBack} />} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {workout.exercises.map((ex) => (
            <View key={ex.id}>
              <View style={[styles.exerciseHeader, styles.gutter]}>
                <Titulo tamanho="md" variante="exercicio">
                  {ex.name}
                </Titulo>
                <IconButton
                  icon="more"
                  label={t('workout.exerciseOptions', { name: ex.name })}
                  onPress={() => setSheet({ removeId: ex.id, name: ex.name })}
                />
              </View>
              {ex.sets.map((set, i) => (
                <SetRow
                  key={set.id}
                  n={i + 1}
                  exerciseName={ex.name}
                  set={set}
                  pr={prs.has(set.id)}
                  onComplete={(values) => complete(ex, set, values)}
                  onUncomplete={() => edit(set.id, { completed: false })}
                  onValues={(patch) => edit(set.id, patch)}
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
            </View>
          ))}
          <View style={styles.gutter}>
            <LinkCaneta onPress={() => navigation.navigate('ExercisePicker', { workoutId })}>{t('workout.addExercise')}</LinkCaneta>
            {failed ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: c.ink }]}>
                {t('workout.saveFailed')}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: c.rule }]}>
          {timer.remaining !== null ? (
            <Linha>
              <View style={styles.restRow}>
                <Text style={[styles.restLabel, { color: c.inkMuted }]}>{t('workout.rest')}</Text>
                <Text style={[styles.restTime, { color: timer.finished ? c.hugger : c.ink }]}>{formatRest(timer.remaining)}</Text>
                <LinkCaneta onPress={() => timer.add(15)}>{t('workout.addRest')}</LinkCaneta>
                <LinkCaneta onPress={timer.skip}>{t('workout.skipRest')}</LinkCaneta>
              </View>
            </Linha>
          ) : null}
          <View style={styles.gutter}>
            <Button variant="primary" size="lg" icon="flag" onPress={() => finish()}>
              {t('workout.finish')}
            </Button>
          </View>
        </View>
      </Folha>

      <Sheet open={sheet === 'empty'} title={t('workout.emptyTitle')} onClose={() => setSheet(null)}>
        <Button block onPress={() => setSheet(null)}>
          {t('workout.back')}
        </Button>
        <Button variant="danger" block onPress={discard}>
          {t('workout.discardWorkout')}
        </Button>
      </Sheet>
      <Sheet open={sheet === 'pending'} title={t('workout.pendingTitle')} onClose={() => setSheet(null)}>
        <Button block onPress={() => finish('complete')}>
          {t('workout.completePending')}
        </Button>
        <Button block onPress={() => finish('discard')}>
          {t('workout.discardPending')}
        </Button>
        <Button block onPress={() => setSheet(null)}>
          {t('workout.back')}
        </Button>
      </Sheet>
      <Sheet open={sheet === 'forgot'} title={t('workout.forgotTitle')} onClose={() => setSheet(null)}>
        <Button block onPress={() => finish('discard')}>
          {t('workout.finishAtLast')}
        </Button>
        <Button block onPress={() => setSheet(null)}>
          {t('workout.keepGoing')}
        </Button>
      </Sheet>
      <Sheet open={typeof sheet === 'object' && sheet !== null} title={typeof sheet === 'object' && sheet ? sheet.name : undefined} onClose={() => setSheet(null)}>
        <Button
          variant="danger"
          block
          onPress={() => {
            const target = sheet as { removeId: string };
            setSheet(null);
            void guard(async () => {
              await removeExercise(db, target.removeId);
              await refresh();
            });
          }}
        >
          {t('workout.removeExercise')}
        </Button>
        <Button block onPress={() => setSheet(null)}>
          {t('workout.cancel')}
        </Button>
      </Sheet>
    </SafeAreaView>
  );
}

interface SetRowProps {
  n: number;
  exerciseName: string;
  set: SetSnapshot;
  pr: boolean;
  onComplete: (values: { weightKg: number | null; reps: number }) => void;
  onUncomplete: () => void;
  onValues: (patch: { weightKg?: number | null; reps?: number }) => void;
}

/** Uma série = uma linha: número (ou A/D/F) na margem, carga × reps, caixinha. Valores a lápis até confirmar. */
function SetRow({ n, exerciseName, set, pr, onComplete, onUncomplete, onValues }: SetRowProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [weight, setWeight] = useState(formatKgInput(set.weightKg));
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps));
  const done = set.completedAt !== null;

  // null = texto inválido ou reps vazias: não conclui nem grava.
  const parsed = () => {
    const w = parseKg(weight);
    const r = parseReps(reps);
    return w.ok && typeof r === 'number' ? { weightKg: w.value, reps: r } : null;
  };

  const save = () => {
    const values = parsed();
    if (values && (values.weightKg !== set.weightKg || values.reps !== set.reps)) onValues(values);
  };

  const label = (key: 'setLabel' | 'weightLabel' | 'repsLabel') => t(`workout.${key}`, { n, name: exerciseName });
  return (
    <Linha
      margem={<Text style={[styles.marginText, { color: c.ink }]}>{set.type === 'normal' ? n : MARGIN_LETTER[set.type]}</Text>}
    >
      <View style={styles.setRow}>
        <NumberField
          style={styles.flex}
          size="md"
          hideLabel
          ariaLabel={label('weightLabel')}
          unit="kg"
          value={weight}
          muted={!done}
          onChange={setWeight}
          onBlur={save}
        />
        <Text style={[styles.times, { color: c.inkMuted }]}>×</Text>
        <NumberField
          style={styles.flex}
          size="md"
          hideLabel
          decimal={false}
          ariaLabel={label('repsLabel')}
          value={reps}
          muted={!done}
          onChange={setReps}
          onBlur={save}
        />
        {pr ? <CarimboPR /> : null}
        <Caixinha
          checked={done}
          label={label('setLabel')}
          onChange={(next) => {
            if (!next) return onUncomplete();
            const values = parsed();
            if (values && values.reps > 0) onComplete(values);
          }}
        />
      </View>
    </Linha>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: space.s4, paddingBottom: space.s5 },
  // Texto livre fica à direita da linha de margem (44px + 2px).
  gutter: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.s4 },
  marginText: { ...text.numMd },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  flex: { flex: 1 },
  times: { ...text.numMd },
  footer: { borderTopWidth: 1, paddingBottom: space.s3 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  restLabel: { ...text.label, flex: 1 },
  restTime: { ...text.numLg },
  error: { ...text.body, paddingTop: space.s2 },
});

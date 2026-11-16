import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Button, EmptyState, Folha, Linha, LinkCaneta, SemanaCaderno, Titulo, TopBar } from '../components';
import { formatKickerDate } from '../i18n';
import { finishedWorkoutStarts, listRoutinesWithLastDone, type RoutineWithLastDone } from '../workout/queries';
import { ActiveWorkoutError, startWorkout } from '../workout/repository';
import { pickTodayRoutine } from '../workout/rules';
import { startOfWeek } from '../workout/week';
import { size, space, text, useTheme } from '../theme';

interface RoutineListScreenProps {
  onNew: () => void;
  /** Abre o editor da rotina (modo "Editar rotinas"). */
  onOpen: (id: string) => void;
  /** Treino criado (ou o que já estava ativo): abre a tela do treino. */
  onStart: (workoutId: string) => void;
}

const DAY_MS = 86_400_000;
/** A, B, C… na margem; passa de Z volta a A (o MVP não tem tantas rotinas). */
const letra = (i: number) => String.fromCharCode(65 + (i % 26));

/** Aba Treinar (início): semana, rotina do dia com o único botão cheio, demais rotinas e atalhos. */
export function RoutineListScreen({ onNew, onOpen, onStart }: RoutineListScreenProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const [routines, setRoutines] = useState<RoutineWithLastDone[] | null>(null);
  const [week, setWeek] = useState<{ startedAt: number; tzOffsetMin: number }[]>([]);
  const [editing, setEditing] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  // A aba fica montada por baixo das telas de fluxo: recarrega sempre que volta ao foco.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const from = startOfWeek(new Date()).getTime() - DAY_MS;
      Promise.all([listRoutinesWithLastDone(db), finishedWorkoutStarts(db, from, from + 9 * DAY_MS)])
        .then(([list, starts]) => {
          if (!alive) return;
          setRoutines(list);
          setWeek(starts);
        })
        .catch((error) => {
          console.error('[rotinas] falha ao ler o banco local', error);
          if (alive) setRoutines([]);
        });
      return () => {
        alive = false;
      };
    }, [db]),
  );

  const start = async (opts: { routineId?: string; name?: string }) => {
    setStartFailed(false);
    try {
      onStart(await startWorkout(db, opts));
    } catch (error) {
      if (error instanceof ActiveWorkoutError) return onStart(error.activeId);
      console.error('[treino] falha ao iniciar', error);
      setStartFailed(true);
    }
  };
  const startFree = () => start({ name: t('train.freeWorkout') });

  const todayId = editing || !routines ? null : pickTodayRoutine(routines);
  const today = routines?.find((r) => r.id === todayId);
  const rows = (routines ?? []).filter((r) => r.id !== todayId);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar title={t('tabs.train')} kicker={formatKickerDate(new Date())} />
        <ScrollView contentContainerStyle={styles.content}>
          {routines === null ? null : routines.length === 0 ? (
            <View style={styles.gutter}>
              <View testID="rotinas-vazio">
                <EmptyState
                  title={t('routines.emptyTitle')}
                  body={t('routines.emptyBody')}
                  action={
                    <Button variant="primary" icon="plus" onPress={onNew}>
                      {t('routines.newRoutine')}
                    </Button>
                  }
                />
              </View>
              <LinkCaneta onPress={startFree}>{t('train.freeWorkout')}</LinkCaneta>
            </View>
          ) : (
            <>
              <View style={styles.gutter}>
                <SemanaCaderno now={new Date()} workouts={week} />
              </View>
              {today ? (
                <View style={[styles.gutter, styles.hero]}>
                  <Text style={[styles.kicker, { color: c.inkMuted }]}>{t('train.todayRoutine')}</Text>
                  <Titulo tamanho="md">{today.name}</Titulo>
                  <Text style={[styles.exercicios, { color: c.inkMuted }]}>{today.exerciseNames.join(' · ')}</Text>
                  <Button variant="primary" size="lg" icon="play" onPress={() => start({ routineId: today.id })}>
                    {t('train.startWorkout')}
                  </Button>
                </View>
              ) : null}
              {rows.length ? <Text style={[styles.kicker, styles.gutter, { color: c.inkMuted }]}>{t('train.otherRoutines')}</Text> : null}
              {rows.map((r) => {
                const list = r.exerciseNames.join(' · ');
                return (
                  <Linha
                    key={r.id}
                    margem={<Text style={[styles.letra, { color: c.ink }]}>{letra(r.order)}</Text>}
                    accessibilityLabel={[r.name, list].filter(Boolean).join('. ')}
                    accessibilityHint={editing ? t('routines.openHint') : undefined}
                    onPress={() => (editing ? onOpen(r.id) : start({ routineId: r.id }))}
                  >
                    <Text style={[styles.nome, { color: c.ink }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {list ? (
                      <Text style={[styles.exercicios, { color: c.inkMuted }]} numberOfLines={1}>
                        {list}
                      </Text>
                    ) : null}
                  </Linha>
                );
              })}
              <View style={styles.gutter}>
                <LinkCaneta onPress={onNew}>{t('routines.newRoutine')}</LinkCaneta>
                <LinkCaneta onPress={() => setEditing((e) => !e)}>{t(editing ? 'train.doneEditing' : 'train.editRoutines')}</LinkCaneta>
                {editing ? null : <LinkCaneta onPress={startFree}>{t('train.freeWorkout')}</LinkCaneta>}
              </View>
            </>
          )}
          {startFailed ? (
            <Text accessibilityRole="alert" style={[styles.erro, styles.gutter, { color: c.ink }]}>
              {t('train.startFailed')}
            </Text>
          ) : null}
        </ScrollView>
      </Folha>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: space.s4, paddingBottom: space.s8 },
  // Texto livre fica à direita da linha de margem (44px + 2px).
  gutter: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  hero: { paddingVertical: space.s4, gap: space.s3 },
  kicker: { ...text.label, paddingTop: space.s3 },
  letra: { ...text.titleMd },
  nome: { ...text.bodyStrong },
  exercicios: { ...text.caption },
  erro: { ...text.body, paddingTop: space.s3 },
});

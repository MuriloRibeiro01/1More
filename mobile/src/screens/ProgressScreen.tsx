import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Alternar, CarimboPR, EmptyState, Folha, GraficoCaderno, Linha, TopBar } from '../components';
import i18n, { formatWeight } from '../i18n';
import { metricSeries, type Metric } from '../progress/series';
import { weeklyMuscleSets } from '../progress/weeklyMuscles';
import { exerciseSessions, trainedExercises, type ExerciseSession, type TrainedExercise } from '../workout/sessions';
import { startOfWeek } from '../workout/week';
import { size, space, text, useTheme } from '../theme';

interface Data {
  exercises: TrainedExercise[];
  selected: string | null;
  sessions: ExerciseSession[];
  muscles: { muscle: string; sets: number }[];
}

const METRICS: readonly Metric[] = ['oneRm', 'bestSet', 'volume'];
const SHORT = { oneRm: 'metricOneRm', bestSet: 'metricBestSet', volume: 'metricVolume' } as const;
const FULL = { oneRm: 'metricOneRmFull', bestSet: 'metricBestSetFull', volume: 'metricVolumeFull' } as const;

/** Aba Progresso: gráfico por exercício direto na folha, recorde → Exercício, séries por músculo na semana. */
export function ProgressScreen() {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const navigation = useNavigation<{ navigate: (name: 'Exercise', params: { exerciseId: string }) => void }>();
  const [data, setData] = useState<Data | null>(null);
  const [metric, setMetric] = useState<Metric>('oneRm');
  const selectedRef = useRef<string | null>(null);

  const load = useCallback(
    async (want?: string) => {
      try {
        const [exercises, muscles] = await Promise.all([trainedExercises(db), weeklyMuscleSets(db, startOfWeek(new Date()))]);
        const keep = want ?? selectedRef.current;
        const selected = exercises.find((e) => e.exerciseId === keep)?.exerciseId ?? exercises[0]?.exerciseId ?? null;
        selectedRef.current = selected;
        setData({ exercises, selected, muscles, sessions: selected ? await exerciseSessions(db, selected) : [] });
      } catch (error) {
        console.error('[progresso] falha ao ler o banco local', error);
      }
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const current = data?.exercises.find((e) => e.exerciseId === data.selected);
  const points = data ? metricSeries(data.sessions, metric) : [];
  const last = points[points.length - 1];
  const best = points.reduce<(typeof points)[number] | undefined>((b, p) => (!b || p.y > b.y ? p : b), undefined);
  const metricName = t(`progress.${FULL[metric]}`);
  const muscleText = data?.muscles.length
    ? data.muscles.map((m) => `${t(`progress.muscles.${m.muscle}`, { defaultValue: m.muscle })} ${m.sets}`).join(' · ')
    : t('progress.weekSetsNone');
  const dateLabel = (ms: number) => new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'pt-BR', { day: 'numeric', month: 'short' }).format(new Date(ms)).replace(/\./g, '');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar title={t('tabs.progress')} />
        {data === null ? null : data.exercises.length === 0 ? (
          <View style={styles.gutter}>
            <EmptyState title={t('progress.emptyTitle')} body={t('progress.emptyBody')} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.gutter, styles.chips]}>
              <Alternar
                label={t('progress.exercise')}
                options={data.exercises.map((e) => ({ id: e.exerciseId, label: e.name }))}
                value={data.selected ?? ''}
                onChange={(id) => void load(id)}
              />
            </ScrollView>
            <View style={styles.gutter}>
              <Alternar label={t('progress.metric')} options={METRICS.map((m) => ({ id: m, label: t(`progress.${SHORT[m]}`) }))} value={metric} onChange={setMetric} />
            </View>

            <View style={styles.chart}>
              {last && current ? (
                <GraficoCaderno
                  points={points}
                  label={t('progress.chartLabel', { count: points.length, metric: metricName, exercise: current.name, last: formatWeight(last.y) })}
                />
              ) : (
                <Text style={[styles.empty, styles.gutter, { color: c.inkMuted }]}>{t('progress.noPoints')}</Text>
              )}
            </View>

            {best && current ? (
              <Linha
                margem={<CarimboPR />}
                accessibilityLabel={`${t('progress.record')}: ${metricName} ${formatWeight(best.y)}, ${dateLabel(best.x)}`}
                accessibilityHint={t('progress.recordHint')}
                onPress={() => navigation.navigate('Exercise', { exerciseId: current.exerciseId })}
              >
                <Text style={[styles.recordValue, { color: c.ink }]}>{`${metricName} ${formatWeight(best.y)}`}</Text>
                <Text style={[styles.caption, { color: c.inkMuted }]}>{`${current.name} · ${dateLabel(best.x)}`}</Text>
              </Linha>
            ) : null}

            <View accessible accessibilityLabel={`${t('progress.weekSets')}: ${muscleText}`}>
              <Linha>
                <Text style={[styles.caption, { color: c.inkMuted }]}>{t('progress.weekSets')}</Text>
                <Text style={[styles.recordValue, { color: c.ink }]}>{muscleText}</Text>
              </Linha>
            </View>
          </ScrollView>
        )}
      </Folha>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: space.s2, paddingBottom: space.s8 },
  // Texto livre fica à direita da linha de margem (44px + 2px).
  gutter: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  chips: { paddingRight: space.s4 },
  chart: { paddingTop: space.s4, paddingBottom: space.s5 },
  empty: { ...text.body, paddingVertical: space.s5 },
  recordValue: { ...text.bodyStrong },
  caption: { ...text.caption },
});

import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Alternar, EmptyState, Folha, Linha, LinkCaneta, MesCaderno, TopBar } from '../components';
import { formatWeight } from '../i18n';
import i18n from '../i18n/instance';
import { groupByWeek, listWorkoutHistory, localDay, weekRangeLabel, workoutsByDay, type HistoryItem } from '../workout/history';
import { formatDuration } from '../workout/summary';
import { startOfWeek } from '../workout/week';
import { size, space, text, useTheme } from '../theme';
import { RegistrarPassadoSheet } from './RegistrarPassadoSheet';

type View_ = 'list' | 'month';
const WEEK_MS_DAYS = 7;

/** Aba Histórico: treinos passados em lista por semana ou no mês; registrar treino retroativo. */
export function HistoryScreen() {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const navigation = useNavigation<{
    navigate: (name: 'WorkoutDetail', params: { workoutId: string; edit?: boolean; isNew?: boolean }) => void;
  }>();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<View_>('list');
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [registering, setRegistering] = useState(false);

  // A aba fica montada por baixo das telas de fluxo: recarrega sempre que volta ao foco.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listWorkoutHistory(db)
        .then((list) => {
          if (!alive) return;
          setItems(list);
          setNow(new Date());
        })
        .catch((error) => {
          console.error('[historico] falha ao ler o banco local', error);
          if (alive) setItems([]);
        });
      return () => {
        alive = false;
      };
    }, [db]),
  );

  const loc = i18n.resolvedLanguage ?? i18n.language;
  const groups = useMemo(() => groupByWeek(items ?? []), [items]);
  const byDay = useMemo(() => workoutsByDay(items ?? []), [items]);
  const open = (workoutId: string) => navigation.navigate('WorkoutDetail', { workoutId });
  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const thisWeek = startOfWeek(now).getTime();
  const weekTitle = (weekStart: Date) =>
    weekStart.getTime() === thisWeek
      ? t('history.thisWeek')
      : weekStart.getTime() === new Date(new Date(thisWeek).getFullYear(), new Date(thisWeek).getMonth(), new Date(thisWeek).getDate() - WEEK_MS_DAYS).getTime()
        ? t('history.lastWeek')
        : weekRangeLabel(weekStart, loc);

  const dayName = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  const monthShort = new Intl.DateTimeFormat(loc, { month: 'short' });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar title={t('tabs.history')} />
        {items === null ? null : items.length === 0 ? (
          <View style={styles.gutter}>
            <EmptyState
              title={t('history.emptyTitle')}
              body={t('history.emptyBody')}
              action={<LinkCaneta onPress={() => setRegistering(true)}>{t('history.registerPast')}</LinkCaneta>}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.gutter}>
              <Alternar
                label={t('history.view')}
                value={view}
                onChange={setView}
                options={[
                  { id: 'list', label: t('history.list') },
                  { id: 'month', label: t('history.month') },
                ]}
              />
            </View>

            {view === 'list' ? (
              groups.map((g) => (
                <View key={g.weekStart.getTime()}>
                  <Text style={[styles.section, styles.gutter, { color: c.inkMuted }]}>{weekTitle(g.weekStart)}</Text>
                  {g.items.map((w) => {
                    const day = localDay(w);
                    const name = w.name || t('workout.freeTitle');
                    return (
                      <Linha
                        key={w.id}
                        margem={
                          <View style={styles.date}>
                            <Text style={[styles.dateDay, { color: c.ink }]}>{day.getDate()}</Text>
                            <Text style={[styles.dateMonth, { color: c.inkMuted }]}>{monthShort.format(day).replace('.', '')}</Text>
                          </View>
                        }
                        accessibilityLabel={`${dayName.format(day)}, ${name}, ${formatDuration(w.durationMs)}`}
                        onPress={() => open(w.id)}
                      >
                        <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={[styles.detail, { color: c.inkMuted }]} numberOfLines={1}>
                          {[formatDuration(w.durationMs), t('history.setsCount', { count: w.validSets }), formatWeight(w.volumeKg)].join(' · ')}
                        </Text>
                      </Linha>
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={styles.month}>
                <MesCaderno
                  year={cursor.year}
                  month={cursor.month}
                  today={now}
                  byDay={new Map([...byDay].map(([k, list]) => [k, list.map((w) => ({ id: w.id, name: w.name || t('workout.freeTitle') }))]))}
                  onSelect={open}
                  onPrev={() => shiftMonth(-1)}
                  onNext={() => shiftMonth(1)}
                />
              </View>
            )}

            <View style={styles.gutter}>
              <LinkCaneta onPress={() => setRegistering(true)}>{t('history.registerPast')}</LinkCaneta>
            </View>
          </ScrollView>
        )}
      </Folha>

      <RegistrarPassadoSheet
        open={registering}
        onClose={() => setRegistering(false)}
        onCreated={(workoutId) => {
          setRegistering(false);
          navigation.navigate('WorkoutDetail', { workoutId, edit: true, isNew: true });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: space.s2, paddingBottom: space.s8 },
  // Texto livre fica à direita da linha de margem (44px + 2px).
  gutter: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  month: { paddingHorizontal: space.s2 },
  section: { ...text.label, paddingTop: space.s4, paddingBottom: space.s1 },
  date: { alignItems: 'center' },
  dateDay: { ...text.numMd },
  dateMonth: { ...text.caption, textTransform: 'uppercase' },
  name: { ...text.bodyStrong },
  detail: { ...text.caption },
});

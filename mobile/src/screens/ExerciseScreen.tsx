import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Alternar, Folha, IconButton, Linha, LivroCaixa, TextField, Titulo, TopBar } from '../components';
import { exerciseName, exerciseRepRange, getExerciseNote, saveExerciseNote } from '../exercise/data';
import { exerciseRecords, type ExerciseRecord, type ExerciseRecords } from '../exercise/records';
import { suggestLoad, type LoadSuggestion } from '../exercise/suggestion';
import { formatNumber, formatWeight } from '../i18n';
import i18n from '../i18n/instance';
import { exerciseSessions, type ExerciseSession } from '../workout/sessions';
import { size, space, text, useTheme } from '../theme';

type Section = 'records' | 'history' | 'how';

interface Data {
  name: string;
  sessions: ExerciseSession[];
  records: ExerciseRecords;
  suggestion: LoadSuggestion | null;
}

const MARK = { warmup: 'A', drop: 'D', failure: 'F' } as const;
/** "82,5×10 · 82,5×9": a mesma linha de diário do treino passado (tipo diferente de normal leva a letra). */
function diary(session: ExerciseSession): string {
  return session.sets
    .map((s) => {
      const body = s.weightKg === null ? String(s.reps) : `${formatNumber(s.weightKg)}×${s.reps}`;
      return s.type === 'normal' ? body : `${MARK[s.type]} ${body}`;
    })
    .join(' · ');
}
const day = (ms: number, tz: number) => new Date(ms + tz * 60_000);
// S11: sempre o idioma do app (não o do aparelho), como as outras telas.
const appLocale = () => i18n.resolvedLanguage ?? i18n.language ?? 'pt-BR';
const longDate = (ms: number, tz: number) =>
  new Intl.DateTimeFormat(appLocale(), { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(day(ms, tz));
const shortMonth = (ms: number, tz: number) =>
  new Intl.DateTimeFormat(appLocale(), { timeZone: 'UTC', month: 'short' }).format(day(ms, tz)).replace('.', '');

/** Tudo sobre um exercício: recordes (RN-11), sugestão de carga (RN-12), sessões anteriores e a nota fixa. */
export function ExerciseScreen({ exerciseId }: { exerciseId: string }) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const navigation = useNavigation<{ goBack: () => void; navigate: (name: 'WorkoutDetail', params: { workoutId: string }) => void }>();
  const [section, setSection] = useState<Section>('records');
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [name, sessions, range, saved] = await Promise.all([
          exerciseName(db, exerciseId),
          exerciseSessions(db, exerciseId),
          exerciseRepRange(db, exerciseId),
          getExerciseNote(db, exerciseId),
        ]);
        if (!alive) return;
        setData({
          name,
          sessions,
          records: exerciseRecords(sessions),
          suggestion: range ? suggestLoad({ sessions, ...range }) : null,
        });
        setNote((current) => current ?? saved ?? '');
      })().catch((error) => console.error('[exercício] falha ao abrir', error));
      return () => {
        alive = false;
      };
    }, [db, exerciseId]),
  );

  const persistNote = () => {
    if (note === null) return;
    saveExerciseNote(db, exerciseId, note).catch((error) => console.error('[exercício] falha ao salvar a nota', error));
  };

  const sections = [
    { id: 'records', label: t('exercise.records') },
    { id: 'history', label: t('exercise.history') },
    { id: 'how', label: t('exercise.how') },
  ] as const;

  const labels = {
    weight: t('exercise.recordWeight'),
    oneRm: t('exercise.recordOneRm'),
    setVolume: t('exercise.recordSetVolume'),
    reps: t('exercise.recordReps'),
  };
  const recordRows = data ? recordLines(data.records, labels, data.sessions) : [];
  const suggestionKey = { raise: 'exercise.suggestRaise', keep: 'exercise.suggestKeep', reduce: 'exercise.suggestReduce' } as const;
  const sentence = data?.suggestion ? t(suggestionKey[data.suggestion.kind], { weight: formatWeight(data.suggestion.weightKg) }) : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar
          title={data?.name ?? ''}
          compact
          left={<IconButton icon="chevron-left" label={t('exercise.back')} onPress={navigation.goBack} />}
        />
        {data ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.gutter}>
              <Alternar options={sections} value={section} onChange={setSection} label={t('exercise.sectionView')} />
            </View>

            {section === 'records' ? (
              <>
                {recordRows.length === 0 ? (
                  <Text style={[styles.empty, styles.gutter, { color: c.inkMuted }]}>{t('exercise.noRecords')}</Text>
                ) : (
                  recordRows.map((r) => (
                    <View key={r.label}>
                      <LivroCaixa rotulo={r.label} valor={r.value} />
                      <Text style={[styles.date, styles.gutter, { color: c.inkMuted }]}>{longDate(r.at.startedAt, r.tz)}</Text>
                    </View>
                  ))
                )}
                {sentence ? (
                  <View style={[styles.section, styles.gutter]}>
                    <Titulo tamanho="md">{t('exercise.suggestion')}</Titulo>
                    <Text style={[styles.suggestion, { color: c.ink }]}>{sentence}</Text>
                    <Text style={[styles.date, { color: c.inkMuted }]}>{t('exercise.suggestionNote')}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {section === 'history' ? (
              data.sessions.length === 0 ? (
                <Text style={[styles.empty, styles.gutter, { color: c.inkMuted }]}>{t('exercise.noSessions')}</Text>
              ) : (
                [...data.sessions].reverse().map((s) => (
                  <Linha
                    key={s.workoutId}
                    accessibilityLabel={`${longDate(s.startedAt, s.tzOffsetMin)}. ${diary(s)}`}
                    onPress={() => navigation.navigate('WorkoutDetail', { workoutId: s.workoutId })}
                    margem={
                      <View style={styles.dateCell}>
                        <Text style={[styles.dayNumber, { color: c.ink }]}>{day(s.startedAt, s.tzOffsetMin).getUTCDate()}</Text>
                        <Text style={[styles.month, { color: c.inkMuted }]}>{shortMonth(s.startedAt, s.tzOffsetMin)}</Text>
                      </View>
                    }
                  >
                    <Text style={[styles.diary, { color: c.ink }]}>{diary(s)}</Text>
                  </Linha>
                ))
              )
            ) : null}

            {section === 'how' ? <Text style={[styles.empty, styles.gutter, { color: c.inkMuted }]}>{t('exercise.howEmpty')}</Text> : null}

            <View style={[styles.section, styles.gutter]}>
              <TextField
                label={t('exercise.note')}
                value={note ?? ''}
                onChange={setNote}
                onBlur={persistNote}
                placeholder={t('exercise.notePlaceholder')}
                multiline
              />
            </View>
          </ScrollView>
        ) : null}
      </Folha>
    </SafeAreaView>
  );
}

function recordLines(r: ExerciseRecords, labels: Record<keyof ExerciseRecords, string>, sessions: ExerciseSession[]) {
  const setText = (x: ExerciseRecord) => `${formatWeight(x.weightKg)} × ${x.reps}`;
  const row = (key: keyof ExerciseRecords, value: (x: ExerciseRecord) => string) => {
    const rec = r[key];
    if (!rec) return [];
    const tz = sessions.find((s) => s.workoutId === rec.workoutId)?.tzOffsetMin ?? 0;
    return [{ label: labels[key], value: value(rec), at: rec, tz }];
  };
  return [
    ...row('weight', setText),
    ...row('oneRm', (x) => formatWeight(x.value)),
    ...row('setVolume', (x) => formatWeight(x.value)),
    ...row('reps', setText),
  ];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: space.s4, paddingBottom: space.s5 },
  // Texto livre fica à direita da linha de margem (44px + 2px).
  gutter: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  section: { paddingTop: space.s5, gap: space.s2 },
  empty: { ...text.body, paddingTop: space.s4 },
  date: { ...text.caption },
  suggestion: { ...text.bodyStrong },
  diary: { ...text.numMd },
  dateCell: { alignItems: 'center' },
  dayNumber: { ...text.numMd },
  month: { ...text.caption },
});

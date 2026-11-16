import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Button, CarimboPR, Folha, Linha, LivroCaixa, TextField, Titulo, TopBar } from '../components';
import { formatNumber, formatSet, formatWeight } from '../i18n';
import { formatDuration, loadSummary, saveNotes, type LoadedSummary } from '../workout/summary';
import { size, space, text, useTheme } from '../theme';

/** Treino finalizado: resumo em livro-caixa, salvo na hora (RN-01). Nada aqui é obrigatório (RN-17). */
export function WorkoutSummaryScreen({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const navigation = useNavigation<{ goBack: () => void }>();
  const [summary, setSummary] = useState<LoadedSummary | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadSummary(db, workoutId)
        .then((s) => {
          if (!alive) return;
          setSummary(s);
          setNotes((current) => current ?? s.notes ?? '');
        })
        .catch((error) => console.error('[treino] falha ao abrir o resumo', error));
      return () => {
        alive = false;
      };
    }, [db, workoutId]),
  );

  const persistNotes = () => {
    if (notes === null) return;
    saveNotes(db, workoutId, notes).catch((error) => console.error('[treino] falha ao salvar a nota', error));
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar title={t('summary.title')} kicker={summary?.name || undefined} />
        {summary ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <LivroCaixa rotulo={t('summary.duration')} valor={formatDuration(summary.durationMs)} />
            <LivroCaixa rotulo={t('summary.volume')} valor={formatWeight(summary.volumeKg)} />
            <LivroCaixa rotulo={t('summary.sets')} valor={formatNumber(summary.validSets, 0)} />
            <LivroCaixa rotulo={t('summary.week')} valor={t('summary.weekDays', { count: summary.weekDays })} />

            {summary.records.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.gutter}>
                  <Titulo tamanho="md">{t('summary.records')}</Titulo>
                </View>
                {summary.records.map((r) => (
                  <Linha key={r.exerciseId} margem={<CarimboPR />}>
                    <Text style={[styles.recordName, { color: c.ink }]}>{r.name}</Text>
                    <Text style={[styles.recordDetail, { color: c.inkMuted }]}>
                      {[r.weightKg !== null && r.reps !== null ? formatSet(r.weightKg, r.reps) : null, r.types.map((p) => t(`summary.prType.${p}`)).join(' · ')]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Linha>
                ))}
              </View>
            ) : null}

            <View style={[styles.section, styles.gutter]}>
              <TextField
                label={t('summary.notes')}
                value={notes ?? ''}
                onChange={setNotes}
                onBlur={persistNotes}
                placeholder={t('summary.notesPlaceholder')}
                multiline
              />
            </View>
          </ScrollView>
        ) : null}

        <View style={[styles.footer, styles.gutter]}>
          <Text style={[styles.saved, { color: c.inkMuted }]}>{t('summary.saved')}</Text>
          <Button variant="primary" size="lg" onPress={navigation.goBack}>
            {t('summary.close')}
          </Button>
        </View>
      </Folha>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: space.s4, paddingBottom: space.s5 },
  // Texto livre fica à direita da linha de margem (44px + 2px).
  gutter: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  section: { paddingTop: space.s5 },
  recordName: { ...text.bodyStrong },
  recordDetail: { ...text.caption },
  footer: { gap: space.s2, paddingTop: space.s3 },
  saved: { ...text.caption },
});

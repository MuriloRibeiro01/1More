import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Button, EmptyState, RoutineCard, TopBar } from '../components';
import { formatKickerDate } from '../i18n';
import { listRoutines } from '../routines/repository';
import type { RoutineSummary } from '../routines/types';
import { space, useTheme } from '../theme';

interface RoutineListScreenProps {
  onNew: () => void;
  onOpen: (id: string) => void;
}

/** Aba Treinar: rotinas salvas no aparelho. Sem "Começar" até existir o treino ativo. */
export function RoutineListScreen({ onNew, onOpen }: RoutineListScreenProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const [routines, setRoutines] = useState<RoutineSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    listRoutines(db)
      .then((list) => alive && setRoutines(list))
      .catch((error) => {
        console.error('[rotinas] falha ao ler o banco local', error);
        if (alive) setRoutines([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.paper }]}>
      <TopBar title={t('tabs.train')} kicker={formatKickerDate(new Date())} />
      <ScrollView contentContainerStyle={styles.content}>
        {routines === null ? null : routines.length === 0 ? (
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
        ) : (
          <>
            {routines.map((r) => (
              <RoutineCard key={r.id} name={r.name} exercises={r.exerciseNames} onOpen={() => onOpen(r.id)} />
            ))}
            <Button variant="secondary" icon="plus" block onPress={onNew}>
              {t('routines.newRoutine')}
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.s4, paddingTop: space.s5, paddingBottom: space.s8, gap: space.s5 },
});

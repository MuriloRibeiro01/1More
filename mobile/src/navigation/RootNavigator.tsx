import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExercisePickerScreen } from '../screens/ExercisePickerScreen';
import { archiveCustomExercise, saveCustomExercise } from '../routines/customExercise';
import { listCatalog } from '../routines/repository';
import type { CatalogExercise } from '../routines/types';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { RestTimerProvider } from '../workout/RestTimerProvider';
import { useActiveWorkout } from '../workout/useActiveWorkout';
import { addExercise, swapExercise } from '../workout/repository';
import { ExerciseScreen } from '../screens/ExerciseScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { WorkoutSummaryScreen } from '../screens/WorkoutSummaryScreen';
import { ActiveWorkoutScreen } from '../screens/ActiveWorkoutScreen';
import { RoutineEditorScreen } from '../screens/RoutineEditorScreen';
import { RootTabs, type RootTabParamList } from './RootTabs';

/** Pilha acima das abas: as abas só aparecem nas 4 telas principais; telas de fluxo ficam por cima, sem abas. */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  RoutineEditor: { routineId?: string } | undefined;
  /** Treino ativo: tela de fluxo, sem abas (Fase 5). */
  ActiveWorkout: { workoutId: string };
  /** Catálogo para acrescentar exercícios ao treino ativo. */
  ExercisePicker: { workoutId: string; /** Troca este exercício do treino (seleção única) em vez de acrescentar. */ replaceWorkoutExerciseId?: string };
  /** Treino finalizado (resumo): substitui o treino ativo na pilha. */
  WorkoutSummary: { workoutId: string };
  /** Treino passado (Histórico). `edit` abre já editável; `isNew` = recém-registrado (sai vazio → descarta). */
  WorkoutDetail: { workoutId: string; edit?: boolean; isNew?: boolean };
  /** Tudo sobre um exercício: recordes, histórico, como fazer (Progresso). */
  Exercise: { exerciseId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RoutineEditorRoute({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'RoutineEditor'>) {
  return <RoutineEditorScreen routineId={route.params?.routineId} onDone={navigation.goBack} />;
}

export function ActiveWorkoutRoute({ route }: NativeStackScreenProps<RootStackParamList, 'ActiveWorkout'>) {
  return <ActiveWorkoutScreen workoutId={route.params.workoutId} />;
}

export function WorkoutSummaryRoute({ route }: NativeStackScreenProps<RootStackParamList, 'WorkoutSummary'>) {
  return <WorkoutSummaryScreen workoutId={route.params.workoutId} />;
}

export function WorkoutDetailRoute({ route }: NativeStackScreenProps<RootStackParamList, 'WorkoutDetail'>) {
  return <WorkoutDetailScreen workoutId={route.params.workoutId} edit={route.params.edit} isNew={route.params.isNew} />;
}

export function ExerciseRoute({ route }: NativeStackScreenProps<RootStackParamList, 'Exercise'>) {
  return <ExerciseScreen exerciseId={route.params.exerciseId} />;
}

export function ExercisePickerRoute({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ExercisePicker'>) {
  const { t } = useTranslation();
  const db = useDatabase();
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);
  const reload = useCallback(
    () =>
      listCatalog(db)
        .then((list) => {
          if (alive.current) setCatalog(list);
        })
        .catch((error) => console.error('[treino] falha ao ler o catálogo', error)),
    [db],
  );
  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  return (
    <ExercisePickerScreen
      catalog={catalog}
      onCancel={navigation.goBack}
      onSaveCustom={async (values, id) => {
        await saveCustomExercise(db, values, id);
        await reload();
      }}
      onArchiveCustom={async (id) => {
        await archiveCustomExercise(db, id); // a tela mostra o aviso se falhar
        await reload();
      }}
      single={!!route.params.replaceWorkoutExerciseId}
      title={route.params.replaceWorkoutExerciseId ? t('workout.swapExercise') : undefined}
      error={failed ? t('picker.saveFailed') : null}
      onConfirm={async (ids) => {
        setFailed(false);
        try {
          const replace = route.params.replaceWorkoutExerciseId;
          if (replace) await swapExercise(db, replace, ids[0]);
          else for (const id of ids) await addExercise(db, route.params.workoutId, id);
        } catch (error) {
          // Não volta ao treino como se tivesse dado certo: o erro fica à vista e o treino fica como estava.
          console.error('[treino] falha ao gravar a escolha de exercícios', error);
          setFailed(true);
          return;
        }
        navigation.goBack();
      }}
    />
  );
}

/** Mantém a tela ligada (sem permissão, sem rede) enquanto o treino ativo existir. */
function KeepAwakeNoTreino() {
  useKeepAwake('treino-ativo');
  return null;
}

/** C19: ligada com treino ativo, inclusive minimizado; libera ao finalizar, descartar ou desmontar. */
function TelaLigadaComTreino() {
  const active = useActiveWorkout(useDatabase());
  return active ? <KeepAwakeNoTreino /> : null;
}

export function RootNavigator() {
  return (
    <RestTimerProvider>
      <TelaLigadaComTreino />
      <Stack.Navigator initialRouteName="Tabs" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RootTabs} />
      <Stack.Screen name="RoutineEditor" component={RoutineEditorRoute} />
      <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute} />
      <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryRoute} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailRoute} />
      <Stack.Screen name="Exercise" component={ExerciseRoute} />
      </Stack.Navigator>
    </RestTimerProvider>
  );
}

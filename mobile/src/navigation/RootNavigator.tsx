import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';
import { ExercisePickerScreen } from '../screens/ExercisePickerScreen';
import { listCatalog } from '../routines/repository';
import type { CatalogExercise } from '../routines/types';
import { addExercise } from '../workout/repository';
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
  ExercisePicker: { workoutId: string };
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
  const db = useDatabase();
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  useEffect(() => {
    let alive = true;
    listCatalog(db)
      .then((list) => alive && setCatalog(list))
      .catch((error) => console.error('[treino] falha ao ler o catálogo', error));
    return () => {
      alive = false;
    };
  }, [db]);

  return (
    <ExercisePickerScreen
      catalog={catalog}
      onCancel={navigation.goBack}
      onConfirm={async (ids) => {
        try {
          for (const id of ids) await addExercise(db, route.params.workoutId, id);
        } catch (error) {
          console.error('[treino] falha ao adicionar exercícios', error);
        }
        navigation.goBack();
      }}
    />
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Tabs" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RootTabs} />
      <Stack.Screen name="RoutineEditor" component={RoutineEditorRoute} />
      <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute} />
      <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryRoute} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailRoute} />
      <Stack.Screen name="Exercise" component={ExerciseRoute} />
    </Stack.Navigator>
  );
}

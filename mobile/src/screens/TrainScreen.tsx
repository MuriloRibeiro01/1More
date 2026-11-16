import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { RoutineListScreen } from './RoutineListScreen';

/** Aba Treinar: início. Editar e o treino ativo abrem como telas de fluxo na pilha (sem abas). */
export function TrainScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <RoutineListScreen
      onNew={() => navigation.navigate('RoutineEditor')}
      onOpen={(routineId) => navigation.navigate('RoutineEditor', { routineId })}
      onStart={(workoutId) => navigation.navigate('ActiveWorkout', { workoutId })}
    />
  );
}

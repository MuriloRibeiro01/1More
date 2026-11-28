import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, ExercisePickerRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { loadWorkout, startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a (d), decisão do PO: se a troca de exercício FALHA, a tela mostra o erro (como o `guard` do treino: role alert)
// e não volta ao treino como se tivesse dado certo; o treino fica exatamente como estava.
jest.mock('../../src/workout/repository', () => ({
  ...jest.requireActual<typeof import('../../src/workout/repository')>('../../src/workout/repository'),
  swapExercise: jest.fn(() => Promise.reject(new Error('falha simulada na troca'))),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const ROSCA = 'Rosca direta';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
let db: Database;
let workoutId: string;

function montar() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ActiveWorkout', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
          <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });

async function tentarTrocar() {
  await fireEvent.press(await botao(`Opções de ${SUPINO}`));
  await fireEvent.press(await botao('Trocar exercício'));
  const linha = await screen.findByRole('checkbox', { name: ROSCA }).catch(() => botao(ROSCA));
  await fireEvent.press(linha);
  const confirmar = screen.queryByRole('button', { name: /^(Trocar|Confirmar)/ });
  if (confirmar) await fireEvent.press(confirmar);
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const ex = (await listCatalog(db)).find((e) => e.name === SUPINO)!;
  const rotina = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ex.id, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('a troca de exercício falha', () => {
  it('mostra um aviso de erro (role alert) em vez de voltar em silêncio', async () => {
    await montar();
    await tentarTrocar();
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
  });

  it('não volta ao treino como se tivesse dado certo: a troca não aparece e o treino não muda', async () => {
    await montar();
    await tentarTrocar();
    await screen.findByRole('alert');
    expect(screen.queryByRole('header', { name: ROSCA })).toBeNull();
    const w = await loadWorkout(db, workoutId);
    expect(w.exercises.map((e) => e.name)).toEqual([SUPINO]);
    expect(w.exercises[0].sets).toHaveLength(3);
  });

  it('o treino continua utilizável depois do erro (dá para concluir uma série)', async () => {
    await montar();
    await tentarTrocar();
    await screen.findByRole('alert');
    // se o erro foi mostrado no seletor, voltar para o treino é escolha da pessoa
    const voltar = screen.queryByRole('button', { name: 'Voltar' });
    if (voltar) await fireEvent.press(voltar);
    await fireEvent.press(await screen.findByRole('checkbox', { name: `Série 1 de ${SUPINO}` }));
    expect((await loadWorkout(db, workoutId)).exercises[0].sets[0].completedAt).not.toBeNull();
  });
});

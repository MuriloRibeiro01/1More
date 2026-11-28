import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, ExerciseRoute, WorkoutDetailRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, getActiveWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a, item 3 (C17): folha ··· do exercício → "Ver histórico e recordes" abre a tela Exercício
// (Recordes · Histórico) e o voltar devolve o treino exatamente como estava: valor digitado e descanso em andamento.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const D = 86_400_000;
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
          <Stack.Screen name="Exercise" component={ExerciseRoute as never} />
          <Stack.Screen name="WorkoutDetail" component={WorkoutDetailRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const caixa = (n: number) => screen.findByRole('checkbox', { name: `Série ${n} de ${SUPINO}` });
const carga = (n: number) => screen.getByLabelText(`Carga da série ${n} de ${SUPINO}`);
const tempoDeDescanso = () => screen.queryByText(/^\d+:\d{2}$/);

async function abrirHistorico() {
  await fireEvent.press(await botao(`Opções de ${SUPINO}`));
  await fireEvent.press(await botao('Ver histórico e recordes'));
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const ex = (await listCatalog(db)).find((e) => e.name === SUPINO)!;
  const rotina = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ex.id, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
  // uma sessão antiga, para a tela Exercício ter o que mostrar
  const antigo = await startWorkout(db, { routineId: rotina, now: Date.now() - 5 * D, tzOffsetMin: 0 });
  const w = await loadWorkout(db, antigo);
  await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 80, reps: 10, completed: true }, Date.now() - 5 * D + 60_000);
  await finishWorkout(db, antigo, { pending: 'discard', now: Date.now() - 5 * D + 1_800_000 });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Ver histórico e recordes (C17)', () => {
  it('a folha ··· oferece "Ver histórico e recordes"', async () => {
    await montar();
    await fireEvent.press(await botao(`Opções de ${SUPINO}`));
    expect(await botao('Ver histórico e recordes')).toBeOnTheScreen();
  });

  it('abre a tela Exercício do exercício certo, com Recordes, Histórico e o recorde da sessão antiga', async () => {
    await montar();
    await abrirHistorico();
    expect(await botao('Recordes')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeOnTheScreen();
    expect(await screen.findByLabelText('Maior carga: 80 kg × 10')).toBeOnTheScreen();
  });

  it('o voltar devolve o treino: valor digitado (ainda sem sair do campo) e descanso em andamento continuam', async () => {
    await montar();
    await fireEvent.press(await caixa(1)); // conclui a 1ª série: o descanso começa
    expect(tempoDeDescanso()).toBeOnTheScreen();
    await fireEvent.changeText(carga(2), '82,5'); // digitado, sem blur
    await abrirHistorico();
    await botao('Recordes'); // estamos na tela Exercício
    await fireEvent.press(await botao('Voltar'));

    expect(await caixa(1)).toBeChecked();
    expect(carga(2).props.value).toBe('82,5');
    expect(tempoDeDescanso()).toBeOnTheScreen();
  });

  it('o treino não é finalizado nem alterado no banco por ir e voltar', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    const antes = await loadWorkout(db, workoutId);
    await abrirHistorico();
    await botao('Recordes');
    await fireEvent.press(await botao('Voltar'));
    await caixa(1);
    expect(await loadWorkout(db, workoutId)).toEqual(antes);
    expect((await getActiveWorkout(db))?.id).toBe(workoutId);
  });

  it('o treino não é desmontado enquanto a tela Exercício está aberta (o descanso segue contando)', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await abrirHistorico();
    await botao('Recordes');
    const escondidos = screen.getAllByText(/^\d+:\d{2}$/, { includeHiddenElements: true });
    expect(escondidos.length).toBeGreaterThan(0);
  });
});

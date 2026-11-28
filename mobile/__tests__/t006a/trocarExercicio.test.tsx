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
import { workoutVolume } from '../../src/workout/rules';
import { loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a, item 2 (C16): folha ··· do exercício → "Trocar exercício".
// Abre o seletor de exercícios com seleção ÚNICA; as séries já concluídas ficam no exercício antigo,
// as pendentes passam para o novo; o volume do treino não muda.
// Contrato de interface: botão "Trocar exercício" na folha; ao tocar no exercício desejado no seletor a troca
// acontece e volta-se ao treino (se houver um botão de confirmar, "Trocar…" ou "Confirmar…", o teste também o toca).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const AGACHAMENTO = 'Agachamento livre';
const ROSCA = 'Rosca direta';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();

let db: Database;
let ids: Record<string, string>;
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
const caixa = (n: number, nome: string) => screen.findByRole('checkbox', { name: `Série ${n} de ${nome}` });
const linhaDoSeletor = (nome: string) =>
  screen.findByRole('checkbox', { name: nome }).catch(() => screen.findByRole('button', { name: nome }));

async function trocarPara(exercicio: string, de = SUPINO) {
  await fireEvent.press(await botao(`Opções de ${de}`));
  await fireEvent.press(await botao('Trocar exercício'));
  await fireEvent.press(await linhaDoSeletor(exercicio));
  const confirmar = screen.queryByRole('button', { name: /^(Trocar|Confirmar)/ });
  if (confirmar) await fireEvent.press(confirmar);
}

const exerciciosDoTreino = async () => (await loadWorkout(db, workoutId)).exercises;
const logs = async () =>
  (await exerciciosDoTreino()).map((e) => ({
    exerciseId: e.exerciseId,
    sets: e.sets.map((s) => ({ type: s.type, weightKg: s.weightKg, reps: s.reps, completedAt: s.completedAt })),
  }));

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  ids = Object.fromEntries([SUPINO, AGACHAMENTO, ROSCA].map((n) => [n, cat.find((e) => e.name === n)!.id]));
  const rotina = await saveRoutine(db, {
    name: 'A',
    exercises: [
      { exerciseId: ids[SUPINO], sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
      { exerciseId: ids[AGACHAMENTO], sets: 2, weightKg: 100, repsMin: null, repsMax: 5, restSeconds: 120 },
    ],
  });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('folha ··· do exercício', () => {
  it('oferece "Trocar exercício" ao lado de "Remover exercício"', async () => {
    await montar();
    await fireEvent.press(await botao(`Opções de ${SUPINO}`));
    expect(await botao('Remover exercício')).toBeOnTheScreen();
    expect(await botao('Trocar exercício')).toBeOnTheScreen();
  });

  it('"Trocar exercício" abre o seletor de exercícios', async () => {
    await montar();
    await fireEvent.press(await botao(`Opções de ${SUPINO}`));
    await fireEvent.press(await botao('Trocar exercício'));
    expect(await linhaDoSeletor(ROSCA)).toBeOnTheScreen();
  });
});

describe('trocar com séries já concluídas', () => {
  beforeEach(async () => {
    const w = await loadWorkout(db, workoutId);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }); // supino série 1 feita
    await updateSet(db, w.exercises[1].sets[0].id, { weightKg: 100, reps: 5, completed: true }); // agachamento série 1 feita
  });

  it('as concluídas ficam no exercício antigo; as pendentes (2) passam para o novo', async () => {
    await montar();
    await trocarPara(ROSCA);
    const ex = await exerciciosDoTreino();
    const antigo = ex.find((e) => e.exerciseId === ids[SUPINO])!;
    const novo = ex.find((e) => e.exerciseId === ids[ROSCA])!;
    expect(antigo.sets).toHaveLength(1);
    expect(antigo.sets[0]).toMatchObject({ weightKg: 60, reps: 10, completedAt: expect.any(Number) });
    expect(novo.sets).toHaveLength(2);
    expect(novo.sets.every((s) => s.completedAt === null)).toBe(true);
  });

  it('o volume do treino não muda', async () => {
    const antes = workoutVolume(await logs());
    expect(antes).toBe(600 + 500);
    await montar();
    await trocarPara(ROSCA);
    expect(workoutVolume(await logs())).toBe(antes);
  });

  it('o outro exercício do treino não é tocado', async () => {
    const antes = (await exerciciosDoTreino()).find((e) => e.exerciseId === ids[AGACHAMENTO])!;
    await montar();
    await trocarPara(ROSCA);
    expect((await exerciciosDoTreino()).find((e) => e.exerciseId === ids[AGACHAMENTO])).toEqual(antes);
  });

  it('a tela volta ao treino mostrando os dois exercícios, com as séries onde ficaram', async () => {
    await montar();
    await trocarPara(ROSCA);
    expect(await screen.findByRole('header', { name: ROSCA })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: SUPINO })).toBeOnTheScreen();
    expect(await caixa(1, SUPINO)).toBeChecked();
    expect(await caixa(1, ROSCA)).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: `Série 3 de ${SUPINO}` })).toBeNull();
  });

  it('a troca já está no banco e o treino continua ativo (RNF-02)', async () => {
    await montar();
    await trocarPara(ROSCA);
    const w = await loadWorkout(db, workoutId);
    expect(w.status).toBe('active');
    expect(w.exercises.map((e) => e.exerciseId)).toContain(ids[ROSCA]);
  });
});

describe('trocar sem nenhuma série concluída', () => {
  it('o exercício antigo some e o novo herda todas as séries pendentes', async () => {
    await montar();
    await trocarPara(ROSCA);
    const ex = await exerciciosDoTreino();
    expect(ex.map((e) => e.exerciseId)).not.toContain(ids[SUPINO]);
    expect(ex.find((e) => e.exerciseId === ids[ROSCA])!.sets).toHaveLength(3);
  });
});

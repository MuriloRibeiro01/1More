import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, ExercisePickerRoute, WorkoutDetailRoute, WorkoutSummaryRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import {
  createRetroactiveWorkout,
  finishWorkout,
  getActiveWorkout,
  loadWorkout,
  startWorkout,
  updateSet,
} from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Fase 7 — treino passado: linhas de diário, Editar/Pronto, Repetir, Excluir (TREINODETALHE.DC.HTML). TDD.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
const NOW = Date.now();
const T0 = NOW - 3 * 86_400_000;
const min = (n: number) => n * 60_000;

let db: Database;
let supino: string;
let rotinaId: string;

function montar(workoutId: string, params: { edit?: boolean; isNew?: boolean } = {}) {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'WorkoutDetail', params: { workoutId, ...params } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="WorkoutDetail" component={WorkoutDetailRoute as never} />
          <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
          <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute as never} />
          <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const linhas = async (t: string) => (await db.get<Model>(t).query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);
const carga = (n: number) => screen.getByLabelText(`Carga da série ${n} de ${SUPINO}`);
const reps = (n: number) => screen.getByLabelText(`Repetições da série ${n} de ${SUPINO}`);

/** Treino de 3 dias atrás: 82,5×10 · 82,5×9 · 80×9 (a última é drop). */
async function passado(inicio = T0) {
  const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin: 0 });
  const w = await loadWorkout(db, id);
  const [a, b, c] = w.exercises[0].sets;
  await updateSet(db, a.id, { weightKg: 82.5, reps: 10, completed: true }, inicio + min(5));
  await updateSet(db, b.id, { weightKg: 82.5, reps: 9, completed: true }, inicio + min(10));
  await updateSet(db, c.id, { weightKg: 80, reps: 9, type: 'drop', completed: true }, inicio + min(15));
  await finishWorkout(db, id, { now: inicio + min(30) });
  return id;
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === SUPINO)!.id;
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [{ exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});

describe('o treino como ficou anotado', () => {
  it('título, exercício e uma linha de diário com carga×reps de cada série (D = drop)', async () => {
    await montar(await passado());
    expect(await screen.findByRole('header', { name: 'Treino A' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: SUPINO })).toBeOnTheScreen();
    expect(screen.getByText('82,5×10 · 82,5×9 · D 80×9')).toBeOnTheScreen();
  });

  it('mostra duração e volume do treino', async () => {
    await montar(await passado());
    expect(await screen.findByLabelText('Duração: 15 min')).toBeOnTheScreen();
    expect(screen.getByLabelText('Volume: 2.287,5 kg')).toBeOnTheScreen(); // 825 + 742,5 + 720
  });

  it('seta voltar vai para o Histórico', async () => {
    await montar(await passado());
    await fireEvent.press(await botao('Voltar'));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
  });
});

describe('repetir este treino (3 toques desde o Histórico)', () => {
  it('cria o treino ativo com os mesmos exercícios e abre a tela do treino', async () => {
    const id = await passado();
    await montar(id);
    await fireEvent.press(await botao('Repetir este treino'));
    expect(await screen.findByRole('header', { name: 'Treino A' })).toBeOnTheScreen();
    expect(await screen.findByRole('checkbox', { name: `Série 1 de ${SUPINO}` })).toBeOnTheScreen();
    const ativo = await getActiveWorkout(db);
    expect(ativo).toMatchObject({ name: 'Treino A' });
    expect(ativo!.id).not.toBe(id);
  });

  it('com outro treino em andamento avisa e não cria nada', async () => {
    const id = await passado();
    await startWorkout(db, { name: 'agora', now: NOW });
    await montar(id);
    await fireEvent.press(await botao('Repetir este treino'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/em andamento/);
    expect((await linhas('workout')).filter((r) => r.status === 'active')).toHaveLength(1);
  });
});

describe('excluir (RN-20)', () => {
  it('pede confirmação em Sheet; cancelar mantém', async () => {
    const id = await passado();
    await montar(id);
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir treino' }));
    expect(await screen.findByText('Excluir este treino?')).toBeOnTheScreen();
    await fireEvent.press(await botao('Cancelar'));
    expect(screen.queryByText('Excluir este treino?')).toBeNull();
    expect((await linhas('workout')).find((r) => r.id === id)!.deleted_at).toBeNull();
  });

  it('confirmar faz tombstone (lógico) e volta ao Histórico', async () => {
    const id = await passado();
    await montar(id);
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir treino' }));
    await fireEvent.press(await botao('Excluir'));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    const w = (await linhas('workout')).find((r) => r.id === id)!;
    expect(w.deleted_at).toEqual(expect.any(Number));
    expect((await linhas('workout_set')).filter((r) => r.deleted_at == null)).toHaveLength(0);
  });
});

describe('editar / pronto (RN-11: PRs e volume recalculam)', () => {
  it('Editar libera as linhas e vira Pronto; Pronto trava de novo', async () => {
    await montar(await passado());
    expect(screen.queryByLabelText(`Carga da série 1 de ${SUPINO}`)).toBeNull();
    await fireEvent.press(await botao('Editar'));
    expect(carga(1).props.value).toBe('82,5');
    expect(reps(3).props.value).toBe('9');
    await fireEvent.press(await botao('Pronto'));
    expect(screen.queryByLabelText(`Carga da série 1 de ${SUPINO}`)).toBeNull();
    expect(screen.getByText('82,5×10 · 82,5×9 · D 80×9')).toBeOnTheScreen();
  });

  it('corrigir carga/reps grava ao sair do campo e o volume recalcula', async () => {
    const id = await passado();
    await montar(id);
    await fireEvent.press(await botao('Editar'));
    await fireEvent.changeText(carga(3), '100');
    await fireEvent(carga(3), 'blur');
    expect((await loadWorkout(db, id)).exercises[0].sets[2]).toMatchObject({ weightKg: 100, reps: 9, completedAt: expect.any(Number) });
    expect(await screen.findByLabelText('Volume: 2.467,5 kg')).toBeOnTheScreen(); // 825 + 742,5 + 900
  });

  it('+ série: linha nova, concluída ao digitar as reps, dentro do intervalo do treino', async () => {
    const id = await passado();
    await montar(id);
    await fireEvent.press(await botao('Editar'));
    await fireEvent.press(await botao(`Adicionar série ${SUPINO}`));
    await fireEvent.changeText(carga(4), '77,5');
    await fireEvent.changeText(reps(4), '8');
    await fireEvent(reps(4), 'blur');
    const w = await loadWorkout(db, id);
    expect(w.exercises[0].sets[3]).toMatchObject({ weightKg: 77.5, reps: 8, completedAt: expect.any(Number) });
    expect(w.endedAt).toBe(w.exercises[0].sets[3].completedAt);
    expect(w.endedAt! - w.startedAt).toBeLessThan(min(60));
  });

  it('remover série pede confirmação e faz tombstone', async () => {
    const id = await passado();
    await montar(id);
    await fireEvent.press(await botao('Editar'));
    await fireEvent.press(await botao(`Remover série 3 de ${SUPINO}`));
    expect(await screen.findByText('Remover do treino?')).toBeOnTheScreen();
    await fireEvent.press(await botao('Remover'));
    expect((await loadWorkout(db, id)).exercises[0].sets).toHaveLength(2);
    expect(screen.queryByLabelText(`Carga da série 3 de ${SUPINO}`)).toBeNull();
  });

  it('o carimbo PR some quando a edição derruba o recorde', async () => {
    await passado(T0 - 10 * 86_400_000); // histórico: 82,5 kg
    const id = await passado(T0); // este treino repete 82,5 → sem recorde
    await montar(id);
    expect(screen.queryByLabelText('Recorde pessoal')).toBeNull();
    await fireEvent.press(await botao('Editar'));
    await fireEvent.changeText(carga(1), '90');
    await fireEvent(carga(1), 'blur');
    expect(await screen.findByLabelText('Recorde pessoal')).toBeOnTheScreen();
    await fireEvent.changeText(carga(1), '82,5');
    await fireEvent(carga(1), 'blur');
    await screen.findByLabelText('Volume: 2.287,5 kg');
    expect(screen.queryByLabelText('Recorde pessoal')).toBeNull();
  });
});

describe('treino recém-registrado (retroativo)', () => {
  it('abre editável; sair sem nenhuma série descarta o treino vazio', async () => {
    const id = await createRetroactiveWorkout(db, { startedAt: T0, name: '' });
    await montar(id, { edit: true, isNew: true });
    expect(await screen.findByRole('button', { name: 'Pronto' })).toBeOnTheScreen();
    await fireEvent.press(await botao('Voltar'));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    expect((await linhas('workout')).find((r) => r.id === id)!.deleted_at).toEqual(expect.any(Number));
  });

  it('com série registrada, sair mantém o treino', async () => {
    const id = await createRetroactiveWorkout(db, { startedAt: T0, name: '' });
    await montar(id, { edit: true, isNew: true });
    await fireEvent.press(await botao('Adicionar exercício'));
    await fireEvent.press(await screen.findByRole('checkbox', { name: SUPINO }));
    await fireEvent.press(await botao('Adicionar 1 exercício'));
    await fireEvent.changeText(await screen.findByLabelText(`Carga da série 1 de ${SUPINO}`), '60');
    await fireEvent.changeText(reps(1), '10');
    await fireEvent(reps(1), 'blur');
    await fireEvent.press(await botao('Voltar'));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    expect((await linhas('workout')).find((r) => r.id === id)!.deleted_at).toBeNull();
  });
});

describe('acessibilidade e offline', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  it('alvos ≥ 48dp e nenhuma chamada de rede', async () => {
    const spy = jest.fn(() => Promise.reject(new Error('sem rede')));
    global.fetch = spy as unknown as typeof fetch;
    await montar(await passado());
    await screen.findByRole('header', { name: SUPINO });
    for (const el of screen.getAllByRole('button')) {
      const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
      expect(Math.max(s?.minHeight ?? 0, s?.height ?? 0)).toBeGreaterThanOrEqual(48);
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

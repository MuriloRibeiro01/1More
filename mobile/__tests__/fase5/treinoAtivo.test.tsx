import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, ExercisePickerRoute, WorkoutSummaryRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, getActiveWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { colors } from '../../src/theme';
import { renderComTema } from '../../test-utils/render';

// Fase 5 — tela do treino ativo, escrita em TDD (testes antes da tela). Critérios do protótipo "TREINO.DC.HTML".
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();

let db: Database;
let supino: string;
let agachamento: string;
let rosca: string;
let rotinaId: string;

function montar(workoutId: string) {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer
        initialState={{ routes: [{ name: 'Home' }, { name: 'ActiveWorkout', params: { workoutId } }] }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
          <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute as never} />
          <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const linhas = async (tabela: string) =>
  (await db.get<Model>(tabela).query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);
const caixa = (n: number, nome = SUPINO) => screen.findByRole('checkbox', { name: `Série ${n} de ${nome}` });
const carga = (n: number, nome = SUPINO) => screen.getByLabelText(`Carga da série ${n} de ${nome}`);
const reps = (n: number, nome = SUPINO) => screen.getByLabelText(`Repetições da série ${n} de ${nome}`);
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const alvo = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minHeight ?? 0, s?.height ?? 0, s?.minWidth ?? 0);
};

const resumo = () => screen.findByRole('header', { name: 'Treino finalizado' });

async function novoTreino(now = Date.now()) {
  return startWorkout(db, { routineId: rotinaId, now });
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
// Concluir série inicia o restTimer (setInterval de 250 ms): relógio falso evita tick real competindo com o banco sob carga.
afterEach(() => {
  jest.useRealTimers();
});
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  const id = (n: string) => cat.find((e) => e.name === n)!.id;
  supino = id(SUPINO);
  agachamento = id('Agachamento livre');
  rosca = id('Rosca direta');
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [
      { exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
      { exerciseId: agachamento, sets: 2, weightKg: null, repsMin: null, repsMax: null, restSeconds: 120 },
    ],
  });
});

describe('estrutura da página do diário', () => {
  it('mostra o nome do treino, cada exercício e uma linha por série com valores a lápis', async () => {
    await montar(await novoTreino());
    expect(await screen.findByRole('header', { name: 'Treino A' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: SUPINO })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Agachamento livre' })).toBeOnTheScreen();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(carga(1).props.value).toBe('60');
    expect(reps(1).props.value).toBe('10');
    expect(StyleSheet.flatten(carga(1).props.style as never).color).toBe(colors.light.inkMuted); // ink-muted: ainda não confirmado
  });

  it('treino livre sem exercícios mostra o título "Treino livre" e o convite a adicionar', async () => {
    const id = await startWorkout(db, { name: '' });
    await montar(id);
    expect(await screen.findByRole('header', { name: 'Treino livre' })).toBeOnTheScreen();
    expect(await botao('Adicionar exercício')).toBeOnTheScreen();
  });

  it('alvos de toque ≥ 48dp nos controles principais', async () => {
    await montar(await novoTreino());
    await caixa(1);
    for (const el of [...screen.getAllByRole('checkbox'), ...screen.getAllByRole('button')]) {
      expect(alvo(el)).toBeGreaterThanOrEqual(48);
    }
  });
});

describe('registrar séries (RNF-02)', () => {
  it('1 toque na caixinha conclui com os valores pré-preenchidos e já está no banco', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await caixa(1));
    const w = await loadWorkout(db, id);
    expect(w.exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 10, completedAt: expect.any(Number) });
    expect(await caixa(1)).toBeChecked();
    expect(StyleSheet.flatten(carga(1).props.style as never).color).toBe(colors.light.ink); // ink: confirmado
  });

  it('digitar carga e reps antes de concluir grava o que foi digitado (vírgula decimal)', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.changeText(carga(2), '82,5');
    await fireEvent.changeText(reps(2), '8');
    await fireEvent.press(await caixa(2));
    expect((await loadWorkout(db, id)).exercises[0].sets[1]).toMatchObject({ weightKg: 82.5, reps: 8 });
  });

  it('corrigir o valor ao sair do campo grava sem concluir', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.changeText(reps(1), '12');
    await fireEvent(reps(1), 'blur');
    expect((await loadWorkout(db, id)).exercises[0].sets[0]).toMatchObject({ reps: 12, completedAt: null });
  });

  it('desmarcar a caixinha volta a série para pendente', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await caixa(1));
    await fireEvent.press(await caixa(1));
    expect((await loadWorkout(db, id)).exercises[0].sets[0].completedAt).toBeNull();
  });

  it('sem repetições não conclui (nada é gravado)', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await caixa(1, 'Agachamento livre'));
    expect((await loadWorkout(db, id)).exercises[1].sets[0].completedAt).toBeNull();
    expect(await caixa(1, 'Agachamento livre')).not.toBeChecked();
  });

  it('+ série copia a última linha', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.changeText(carga(3), '70');
    await fireEvent(carga(3), 'blur');
    await fireEvent.press(await botao(`Adicionar série ${SUPINO}`));
    expect(await caixa(4)).toBeOnTheScreen();
    expect(carga(4).props.value).toBe('70');
    expect((await loadWorkout(db, id)).exercises[0].sets).toHaveLength(4);
  });
});

describe('descanso', () => {
  it('concluir uma série inicia o descanso do exercício; +15 s soma; Pular esconde', async () => {
    await montar(await novoTreino());
    expect(screen.queryByText('Descanso')).toBeNull();
    await fireEvent.press(await caixa(1));
    expect(await screen.findByText('Descanso')).toBeOnTheScreen();
    expect(screen.getByText('1:30')).toBeOnTheScreen();
    await fireEvent.press(await botao('+15 s'));
    expect(screen.getByText('1:45')).toBeOnTheScreen();
    await fireEvent.press(await botao('Pular'));
    expect(screen.queryByText('Descanso')).toBeNull();
  });

  it('usa o descanso de cada exercício (agachamento = 2:00)', async () => {
    await montar(await novoTreino());
    await fireEvent.changeText(reps(1, 'Agachamento livre'), '10');
    await fireEvent.press(await caixa(1, 'Agachamento livre'));
    expect(await screen.findByText('2:00')).toBeOnTheScreen();
  });
});

describe('recorde pessoal (RN-11)', () => {
  async function historico() {
    const id = await novoTreino(Date.now() - 86_400_000 * 3);
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, Date.now() - 86_400_000 * 3 + 60_000);
    await finishWorkout(db, id, { pending: 'discard', now: Date.now() - 86_400_000 * 3 + 120_000 });
  }

  it('carga acima do histórico mostra o carimbo PR no momento da conclusão', async () => {
    await historico();
    await montar(await novoTreino());
    await fireEvent.changeText(carga(1), '62,5');
    await fireEvent.press(await caixa(1));
    expect(await screen.findByLabelText('Recorde pessoal')).toBeOnTheScreen();
  });

  it('repetir a carga do histórico não é recorde; primeiro treino também não', async () => {
    await historico();
    await montar(await novoTreino());
    await fireEvent.press(await caixa(1));
    expect(await caixa(1)).toBeChecked();
    expect(screen.queryByLabelText('Recorde pessoal')).toBeNull();
  });

  it('aquecimento nunca é PR', async () => {
    await historico();
    const id = await novoTreino();
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { type: 'warmup', weightKg: 100 });
    await montar(id);
    await fireEvent.press(await caixa(1));
    expect(await caixa(1)).toBeChecked();
    expect(screen.queryByLabelText('Recorde pessoal')).toBeNull();
  });
});

describe('finalizar (RN-05, RN-06)', () => {
  async function concluirTudo(id: string) {
    const w = await loadWorkout(db, id);
    for (const ex of w.exercises) {
      for (const s of ex.sets) await updateSet(db, s.id, { weightKg: s.weightKg ?? 20, reps: s.reps ?? 10, completed: true });
    }
  }

  it('tudo feito: finaliza sem perguntar e abre o resumo', async () => {
    const id = await novoTreino();
    await concluirTudo(id);
    await montar(id);
    await fireEvent.press(await botao('Finalizar'));
    expect(await resumo()).toBeOnTheScreen();
    expect((await loadWorkout(db, id)).status).toBe('finished');
    expect(await getActiveWorkout(db)).toBeNull();
  });

  it('nenhuma série: Sheet de descartar (RN-05); descartar apaga logicamente e volta', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await botao('Finalizar'));
    expect(await screen.findByText('Nenhuma série concluída')).toBeOnTheScreen();
    expect((await loadWorkout(db, id)).status).toBe('active');
    await fireEvent.press(await botao('Descartar treino'));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    expect((await linhas('workout')).find((r) => r.id === id)!.deleted_at).toEqual(expect.any(Number));
  });

  it('nenhuma série: "Voltar" fecha o Sheet e o treino segue', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await botao('Finalizar'));
    await fireEvent.press(await botao('Voltar'));
    expect(screen.queryByText('Nenhuma série concluída')).toBeNull();
    expect((await loadWorkout(db, id)).status).toBe('active');
  });

  it('pendentes: Sheet RN-06 com 3 saídas; "Marcar como concluídas" finaliza com os valores preenchidos', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await caixa(1));
    await fireEvent.press(await botao('Finalizar'));
    expect(await screen.findByText('Há séries sem concluir')).toBeOnTheScreen();
    expect(await botao('Descartar pendentes')).toBeOnTheScreen();
    expect(await botao('Voltar')).toBeOnTheScreen();
    await fireEvent.press(await botao('Marcar como concluídas'));
    expect(await resumo()).toBeOnTheScreen();
    const w = await loadWorkout(db, id);
    expect(w.status).toBe('finished');
    // T-006e/S1: só pendentes com reps > 0 são concluídas (as sem reps seguem pendentes, como em updateSet)
    const sets = w.exercises.flatMap((e) => e.sets);
    expect(sets.filter((s) => (s.reps ?? 0) > 0).every((s) => s.completedAt !== null)).toBe(true);
    expect(sets.filter((s) => !((s.reps ?? 0) > 0)).every((s) => s.completedAt === null)).toBe(true);
  });

  it('pendentes: "Descartar pendentes" finaliza só com o que foi feito', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await caixa(1));
    await fireEvent.press(await botao('Finalizar'));
    await fireEvent.press(await botao('Descartar pendentes'));
    expect(await resumo()).toBeOnTheScreen();
    const w = await loadWorkout(db, id);
    expect(w.exercises.map((e) => e.sets.length)).toEqual([1]);
  });
});

describe('minimizar, exercícios e esquecido', () => {
  it('seta para baixo minimiza: volta e o treino continua ativo', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await botao('Minimizar treino'));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    expect((await getActiveWorkout(db))?.id).toBe(id);
  });

  it('··· do exercício → Remover (Sheet): tira o exercício e faz tombstone', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await botao(`Opções de ${SUPINO}`));
    await fireEvent.press(await botao('Remover exercício'));
    expect(screen.queryByRole('header', { name: SUPINO })).toBeNull();
    expect((await loadWorkout(db, id)).exercises.map((e) => e.exerciseId)).toEqual([agachamento]);
  });

  it('+ Adicionar exercício abre o catálogo; escolher e confirmar volta com o exercício no treino', async () => {
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await botao('Adicionar exercício'));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Rosca direta' }));
    await fireEvent.press(await botao('Adicionar 1 exercício'));
    expect(await screen.findByRole('header', { name: 'Rosca direta' })).toBeOnTheScreen();
    expect((await loadWorkout(db, id)).exercises.map((e) => e.exerciseId)).toEqual([supino, agachamento, rosca]);
  });

  it('treino parado há mais de 4 h pergunta "Esqueceu de finalizar?" e finaliza na última série (RN-04)', async () => {
    const inicio = Date.now() - 6 * 3_600_000;
    const id = await novoTreino(inicio);
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, inicio + 600_000);
    await montar(id);
    expect(await screen.findByText('Esqueceu de finalizar?')).toBeOnTheScreen();
    await fireEvent.press(await botao('Finalizar na última série'));
    expect(await resumo()).toBeOnTheScreen();
    const depois = await loadWorkout(db, id);
    expect(depois).toMatchObject({ status: 'finished', endedAt: inicio + 600_000 });
  });

  it('"Continuar treino" fecha a pergunta e mantém o treino', async () => {
    const inicio = Date.now() - 6 * 3_600_000;
    const id = await novoTreino(inicio);
    await montar(id);
    await fireEvent.press(await botao('Continuar treino'));
    expect(screen.queryByText('Esqueceu de finalizar?')).toBeNull();
    expect((await loadWorkout(db, id)).status).toBe('active');
  });
});

describe('offline (RNF-01)', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });
  it('registrar e finalizar não faz nenhuma chamada de rede', async () => {
    const spy = jest.fn(() => Promise.reject(new Error('sem rede')));
    global.fetch = spy as unknown as typeof fetch;
    const id = await novoTreino();
    await montar(id);
    await fireEvent.press(await caixa(1));
    await fireEvent.press(await botao('Finalizar'));
    await fireEvent.press(await botao('Descartar pendentes'));
    expect(spy).not.toHaveBeenCalled();
  });
});

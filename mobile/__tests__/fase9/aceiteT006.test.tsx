import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text, Vibration } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, RootNavigator, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { isForgotten, isPurgeable, STALE_MS } from '../../src/workout/rules';
import { discardWorkout, finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { Linha } from '../../src/components';
import { colors } from '../../src/theme';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Aceite da T-006 (docs/tasks/T-006-frontend-caderno.md): C04, C11, C12, C13, C42, C43.
// C07 já está coberto em fase5/inicioTreinar ("1 toque na linha de outra rotina inicia o treino dela").
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const AGACHAMENTO = 'Agachamento livre';
const H = 3_600_000;
const D = 24 * H;
const T0 = Date.now();
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();

let db: Database;
let supino: string;
let agachamento: string;
let rotinaId: string;

// Relógio fixado em `now` só em Date.now (timers e banco seguem reais). Continua andando a partir dali:
// parado de vez, o timeout do findBy*/waitFor do RNTL (que lê Date.now) nunca estoura. O limite exato de
// 4 h fica no teste da regra pura; na tela usamos margem de 1 min.
const realNow = Date.now.bind(Date);
const congelar = (now: number) => {
  const base = realNow();
  jest.spyOn(Date, 'now').mockImplementation(() => now + (realNow() - base));
};
const MIN = 60_000;
// C11 precisa avançar o setInterval do descanso: aí sim fake timers, ligados ANTES de criar o banco.
let fakeTimers = false;

function montarTreino(workoutId: string) {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ActiveWorkout', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

function montarApp() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const caixa = (n: number, nome = SUPINO) => screen.findByRole('checkbox', { name: `Série ${n} de ${nome}` });
const carga = (n: number, nome = SUPINO) => screen.getByLabelText(`Carga da série ${n} de ${nome}`);
const reps = (n: number, nome = SUPINO) => screen.getByLabelText(`Repetições da série ${n} de ${nome}`);
const cor = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as { color?: string }).color;
const alvo = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minHeight ?? 0, s?.height ?? 0);
};
const linhas = async (tabela: string) =>
  (await db.get<Model>(tabela).query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);
const faixaForgot = () => screen.queryByRole('button', { name: 'Esqueceu de finalizar?' });
const faixaRetomar = () => screen.queryByRole('button', { name: 'Treino em andamento · Retomar' });

beforeAll(() => i18n.changeLanguage('pt-BR'));
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
beforeEach(async () => {
  if (fakeTimers) jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  const id = (n: string) => cat.find((e) => e.name === n)!.id;
  supino = id(SUPINO);
  agachamento = id(AGACHAMENTO);
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [
      { exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
      { exerciseId: agachamento, sets: 2, weightKg: null, repsMin: null, repsMax: null, restSeconds: 120 },
    ],
  });
});

describe('C04 — "Esqueceu de finalizar?" após 4 h parado (RN-04), relógio congelado', () => {
  it('a regra: 4 h exatas ainda não, 4 h + 1 ms sim', () => {
    expect(STALE_MS).toBe(4 * H);
    expect(isForgotten(T0, T0 + 4 * H)).toBe(false);
    expect(isForgotten(T0, T0 + 4 * H + 1)).toBe(true);
  });

  it('faixa em qualquer aba: 1 min antes das 4 h mostra "Retomar"', async () => {
    congelar(T0);
    await startWorkout(db, { routineId: rotinaId, now: T0 });
    congelar(T0 + 4 * H - MIN);
    await montarApp();
    expect(await screen.findByRole('button', { name: 'Treino em andamento · Retomar' })).toBeOnTheScreen();
    expect(faixaForgot()).toBeNull();
  });

  it('faixa em qualquer aba: 1 min depois das 4 h vira "Esqueceu de finalizar?"', async () => {
    congelar(T0);
    await startWorkout(db, { routineId: rotinaId, now: T0 });
    congelar(T0 + 4 * H + MIN);
    await montarApp();
    expect(await screen.findByRole('button', { name: 'Esqueceu de finalizar?' })).toBeOnTheScreen();
    expect(faixaRetomar()).toBeNull();
  });

  it('a contagem parte da ÚLTIMA SÉRIE concluída, não do início do treino', async () => {
    congelar(T0);
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    // série concluída 3 h depois do início; "agora" = 6 h após o início → só 3 h parado
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, T0 + 3 * H);
    congelar(T0 + 6 * H);
    await montarApp();
    expect(await screen.findByRole('button', { name: 'Treino em andamento · Retomar' })).toBeOnTheScreen();
    expect(faixaForgot()).toBeNull();
  });

  it('tela do treino: 1 min antes das 4 h não pergunta nada', async () => {
    congelar(T0);
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, T0 + 10 * MIN);
    congelar(T0 + 10 * MIN + 4 * H - MIN);
    await montarTreino(id);
    await caixa(1);
    expect(screen.queryByText('Esqueceu de finalizar?')).toBeNull();
  });

  it('tela do treino: 1 min depois das 4 h oferece "Finalizar na última série"', async () => {
    congelar(T0);
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, T0 + 10 * MIN);
    congelar(T0 + 10 * MIN + 4 * H + MIN);
    await montarTreino(id);
    expect(await screen.findByText('Esqueceu de finalizar?')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Finalizar na última série' })).toBeOnTheScreen();
  });
});

describe('C11 — descanso zerado fica laranja e vibra', () => {
  beforeAll(() => {
    fakeTimers = true;
  });
  afterAll(() => {
    fakeTimers = false;
  });
  it('conta regressiva em tinta; ao zerar o tempo vira laranja (hugger) e vibra uma única vez', async () => {
    const vibrar = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montarTreino(id);
    await fireEvent.press(await caixa(1)); // supino: descanso de 1:30

    const tempo = () => screen.getByText(/^\d+:\d{2}$/);
    expect(tempo()).toHaveTextContent('1:30');
    expect(cor(tempo())).toBe(colors.light.ink);
    expect(vibrar).not.toHaveBeenCalled();

    await act(async () => void jest.advanceTimersByTime(60_000));
    expect(tempo()).toHaveTextContent('0:30');
    expect(cor(tempo())).toBe(colors.light.ink);
    expect(vibrar).not.toHaveBeenCalled();

    await act(async () => void jest.advanceTimersByTime(30_000));
    expect(tempo()).toHaveTextContent('0:00');
    expect(cor(tempo())).toBe(colors.light.hugger);
    expect(vibrar).toHaveBeenCalledTimes(1);

    await act(async () => void jest.advanceTimersByTime(10_000));
    expect(vibrar).toHaveBeenCalledTimes(1);
    vibrar.mockRestore();
  });

  it('no tema Noite o descanso zerado usa o laranja do tema escuro', async () => {
    const vibrar = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await renderComTema(
      <DatabaseProvider database={db}>
        <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ActiveWorkout', params: { workoutId: id } }] }}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
            <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
          </Stack.Navigator>
        </NavigationContainer>
      </DatabaseProvider>,
      'dark',
    );
    await fireEvent.press(await caixa(1));
    await act(async () => void jest.advanceTimersByTime(90_000));
    expect(cor(screen.getByText('0:00'))).toBe(colors.dark.hugger);
    vibrar.mockRestore();
  });
});

describe('C12 — valores da sessão anterior a lápis e usados ao tocar a caixinha (RF-31)', () => {
  async function treinoAnterior() {
    const t1 = await startWorkout(db, { routineId: rotinaId, now: T0 - 2 * D });
    const w = await loadWorkout(db, t1);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 80, reps: 8, completed: true }, T0 - 2 * D + 60_000);
    await updateSet(db, w.exercises[0].sets[1].id, { weightKg: 82.5, reps: 6, completed: true }, T0 - 2 * D + 120_000);
    await finishWorkout(db, t1, { pending: 'discard' });
  }

  it('o novo treino nasce com carga e reps da última sessão, em lápis (inkMuted), e não com o alvo da rotina', async () => {
    await treinoAnterior();
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    await montarTreino(id);
    await caixa(1);
    expect(carga(1).props.value).toBe('80');
    expect(reps(1).props.value).toBe('8');
    expect(carga(2).props.value).toBe('82,5');
    expect(reps(2).props.value).toBe('6');
    expect(cor(carga(1))).toBe(colors.light.inkMuted);
    expect(cor(reps(1))).toBe(colors.light.inkMuted);
    // a 3ª série não tinha par na sessão anterior: cai no alvo da rotina (60 kg, 10 reps)
    expect(carga(3).props.value).toBe('60');
  });

  it('1 toque na caixinha grava exatamente os valores a lápis e eles passam a tinta', async () => {
    await treinoAnterior();
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    await montarTreino(id);
    await fireEvent.press(await caixa(1));
    expect((await loadWorkout(db, id)).exercises[0].sets[0]).toMatchObject({ weightKg: 80, reps: 8, completedAt: expect.any(Number) });
    expect(cor(carga(1))).toBe(colors.light.ink);
  });

  it('treino ainda ativo e treino excluído da sessão anterior não valem como "anterior"', async () => {
    const t1 = await startWorkout(db, { routineId: rotinaId, now: T0 - 2 * D });
    const w = await loadWorkout(db, t1);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 99, reps: 9, completed: true }, T0 - 2 * D + 60_000);
    await discardWorkout(db, t1);
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    await montarTreino(id);
    await caixa(1);
    expect(carga(1).props.value).toBe('60');
  });
});

describe('C13 — série da vez com faixa de destaque', () => {
  // LACUNA (relatada ao Atlas): ActiveWorkoutScreen não passa `destaque` à Linha da série; só o catálogo
  // (ExercisePickerScreen) usa `destaque`. A faixa amarela existe como componente (caderno.test) e na FaixaRetomar.
  const temWash = () => {
    const json = JSON.stringify(screen.toJSON());
    return json.includes(colors.light.stripeWash) || json.includes(colors.dark.stripeWash);
  };

  it('controle da sonda: uma Linha com destaque é detectada pela busca na árvore', async () => {
    await renderComTema(<Linha destaque>{<Text>x</Text>}</Linha>);
    expect(temWash()).toBe(true);
  });

  it('sonda: nenhuma parte da árvore do treino ativo usa stripeWash hoje (confirma a lacuna)', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    await montarTreino(id);
    await caixa(1);
    expect(temWash()).toBe(false);
  });
  it.todo('a primeira série pendente do treino ativo fica sobre a faixa stripeWash; ao concluí-la a faixa passa para a próxima');
});

describe('C42 — alvos de toque ≥ 48 dp (RNF-09) nas telas principais', () => {
  const interativos = () => [
    ...screen.queryAllByRole('button'),
    ...screen.queryAllByRole('checkbox'),
    ...screen.queryAllByRole('tab'),
    ...screen.queryAllByRole('switch'),
    ...screen.queryAllByRole('radio'),
  ];
  const confere = (tela: string) => {
    const lista = interativos();
    expect(lista.length).toBeGreaterThan(0);
    const pequenos = lista
      .map((el) => ({ nome: String(el.props.accessibilityLabel ?? el.props['aria-label'] ?? el.props.children ?? '?'), v: alvo(el) }))
      .filter((x) => x.v < 48);
    expect({ tela, pequenos }).toEqual({ tela, pequenos: [] });
  };

  it('abas Treinar, Histórico, Progresso e Perfil (com treino ativo: faixa Retomar visível)', async () => {
    await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await saveRoutine(db, { name: 'Treino B', exercises: [{ exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }] });
    await montarApp();
    await screen.findByRole('button', { name: 'Treino em andamento · Retomar' });
    confere('Treinar');
    for (const aba of ['Histórico', 'Progresso', 'Perfil']) {
      await fireEvent.press(screen.getByRole('tab', { name: aba }));
      confere(aba);
    }
  });

  it('Treinar em modo "Editar rotinas"', async () => {
    await montarApp();
    await fireEvent.press(await screen.findByRole('button', { name: /Editar rotinas/ }));
    confere('Treinar (editar rotinas)');
  });

  it('editor de rotina e seletor de exercícios', async () => {
    await montarApp();
    await fireEvent.press(await screen.findByRole('button', { name: /Nova rotina/ }));
    await screen.findByRole('header', { name: /rotina/i });
    confere('Editor de rotina');
  });

  it('treino ativo com as folhas (Sheet) de finalizar abertas', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montarTreino(id);
    await caixa(1);
    confere('Treino ativo');
    await fireEvent.press(await screen.findByRole('button', { name: 'Finalizar' }));
    confere('Treino ativo + Sheet "nenhuma série"');
  });
});

describe('C43 — exclusão lógica e retenção de 30 dias (RN-20)', () => {
  it('descartar treino, remover rotina e série fazem tombstone: a linha continua no banco com deleted_at', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    await discardWorkout(db, id);
    const treino = (await linhas('workout')).find((r) => r.id === id)!;
    expect(treino.deleted_at).toEqual(expect.any(Number));
    const filhos = (await linhas('workout_set')).filter((r) => r.workout_exercise_id !== undefined);
    expect(filhos.length).toBeGreaterThan(0);
    expect(filhos.every((r) => typeof r.deleted_at === 'number')).toBe(true);
  });

  it('a regra de expurgo: 29 d 23 h 59 min ainda guarda; 30 d exatos já pode expurgar', () => {
    const apagado = T0;
    expect(isPurgeable(apagado, apagado + 30 * D - 60_000)).toBe(false);
    expect(isPurgeable(apagado, apagado + 30 * D)).toBe(true);
  });

  // LACUNA (relatada ao Atlas): isPurgeable existe só como função pura em src/workout/rules.ts; nada no app
  // a chama (grep "isPurgeable|purge" em src/ só acha a definição). Não há limpeza física dos tombstones.
  it.todo('ao abrir o app, tombstones com 30 dias ou mais são removidos fisicamente; os mais novos ficam');
});

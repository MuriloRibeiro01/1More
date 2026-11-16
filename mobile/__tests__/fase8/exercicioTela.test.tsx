import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import { getExerciseNote, saveExerciseNote } from '../../src/exercise/data';
import i18n from '../../src/i18n';
import { ExerciseRoute, WorkoutDetailRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Fase 8 — tela Exercício (EXERCICIO.DC.HTML): Recordes · Histórico · Como fazer, sugestão RN-12 e nota. TDD.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
const D = 86_400_000;
const T0 = Date.now() - 10 * D;
const min = (n: number) => n * 60_000;

let db: Database;
let supino: string;
let rotinaId: string;

function montar(exerciseId = supino) {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'Exercise', params: { exerciseId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="Exercise" component={ExerciseRoute as never} />
          <Stack.Screen name="WorkoutDetail" component={WorkoutDetailRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });

async function treino(inicio: number, series: [number, number][]) {
  const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin: 0 });
  const w = await loadWorkout(db, id);
  for (let i = 0; i < series.length; i++) {
    await updateSet(db, w.exercises[0].sets[i].id, { weightKg: series[i][0], reps: series[i][1], completed: true }, inicio + min(i + 1));
  }
  await finishWorkout(db, id, { pending: 'discard', now: inicio + min(30) });
  return id;
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === SUPINO)!.id;
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [{ exerciseId: supino, sets: 3, weightKg: 60, repsMin: 8, repsMax: 10, restSeconds: 90 }],
  });
});

describe('cabeçalho e seções', () => {
  it('título é o nome do exercício; seta voltar leva à tela de origem', async () => {
    await montar();
    expect(await screen.findByRole('header', { name: SUPINO })).toBeOnTheScreen();
    await fireEvent.press(await botao('Voltar'));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
  });

  it('três seções, Recordes é a padrão; a escolhida fica selected', async () => {
    await montar();
    expect(await botao('Recordes')).toBeSelected();
    expect(screen.getByRole('button', { name: 'Histórico' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Como fazer' }));
    expect(screen.getByRole('button', { name: 'Como fazer' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Recordes' })).not.toBeSelected();
  });
});

describe('recordes', () => {
  it('sem sessões mostra o convite e nenhuma linha de recorde', async () => {
    await montar();
    expect(await screen.findByText(/Sem recordes ainda/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Maior carga/)).toBeNull();
  });

  it('livro-caixa com maior carga, 1RM, maior volume e mais repetições', async () => {
    await treino(T0, [[82.5, 10], [80, 12]]);
    await montar();
    expect(await screen.findByLabelText('Maior carga: 82,5 kg × 10')).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM estimado: 112 kg')).toBeOnTheScreen(); // 80×(1+12/30) = 112 > 82,5×(1+10/30) = 110
    expect(screen.getByLabelText('Maior volume numa série: 960 kg')).toBeOnTheScreen(); // 80×12
    expect(screen.getByLabelText('Mais repetições: 80 kg × 12')).toBeOnTheScreen();
  });
});

describe('sugestão de carga (RN-12, só sugestão)', () => {
  it('todas as séries no topo da faixa sugere subir 2,5 kg e deixa claro que é só sugestão', async () => {
    await treino(T0, [[80, 10], [80, 10], [80, 10]]);
    await montar();
    expect(await screen.findByText('Subir para 82,5 kg')).toBeOnTheScreen();
    expect(screen.getByText('É só uma sugestão: você escolhe a carga.')).toBeOnTheScreen();
  });

  it('faixa no meio mantém a carga', async () => {
    await treino(T0, [[80, 9], [80, 9]]);
    await montar();
    expect(await screen.findByText('Manter 80 kg')).toBeOnTheScreen();
  });

  it('2 sessões seguidas abaixo do mínimo sugere reduzir 10%', async () => {
    await treino(T0, [[80, 6]]);
    await treino(T0 + 3 * D, [[80, 5]]);
    await montar();
    expect(await screen.findByText('Reduzir para 72 kg')).toBeOnTheScreen();
  });

  it('sem faixa de reps na rotina não há sugestão', async () => {
    const outra = await saveRoutine(db, { name: 'Livre', exercises: [{ exerciseId: supino, sets: 3, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }] });
    await new Promise((r) => setTimeout(r, 5));
    rotinaId = outra;
    await treino(T0, [[80, 10]]);
    await montar();
    await screen.findByLabelText('Maior carga: 80 kg × 10');
    expect(screen.queryByText('Sugestão')).toBeNull();
  });
});

describe('histórico', () => {
  it('sem sessões: mensagem', async () => {
    await montar();
    await fireEvent.press(await botao('Histórico'));
    expect(await screen.findByText('Nenhuma sessão ainda.')).toBeOnTheScreen();
  });

  it('sessões da mais nova para a mais antiga, com a linha de diário; toque abre o treino', async () => {
    const antigo = await treino(T0, [[80, 10], [80, 9]]);
    const novo = await treino(T0 + 4 * D, [[82.5, 8]]);
    await montar();
    await fireEvent.press(await botao('Histórico'));
    const linhas = await screen.findAllByRole('button', { name: /×/ });
    expect(linhas[0].props.accessibilityLabel).toMatch(/82,5×8/);
    expect(linhas[1].props.accessibilityLabel).toMatch(/80×10 · 80×9/);
    expect(novo).not.toBe(antigo);
    await fireEvent.press(linhas[1]);
    expect(await screen.findByRole('header', { name: 'Treino A' })).toBeOnTheScreen();
    expect(await screen.findByText('80×10 · 80×9')).toBeOnTheScreen();
  });
});

describe('como fazer', () => {
  it('a demonstração ainda não existe: avisa em vez de inventar conteúdo', async () => {
    await montar();
    await fireEvent.press(await botao('Como fazer'));
    expect(await screen.findByText('A demonstração deste exercício ainda não está disponível.')).toBeOnTheScreen();
  });
});

describe('minha nota', () => {
  it('visível em todas as seções; salva ao sair do campo', async () => {
    await montar();
    const campo = await screen.findByLabelText('Minha nota');
    await fireEvent.changeText(campo, 'Banco no 3, pegada média');
    await fireEvent(campo, 'blur');
    expect(await getExerciseNote(db, supino)).toBe('Banco no 3, pegada média');
    await fireEvent.press(screen.getByRole('button', { name: 'Histórico' }));
    expect(screen.getByLabelText('Minha nota')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Como fazer' }));
    expect(screen.getByLabelText('Minha nota')).toBeOnTheScreen();
  });

  it('mostra a nota já salva', async () => {
    await saveExerciseNote(db, supino, 'Cuidado com o ombro');
    await montar();
    expect((await screen.findByLabelText('Minha nota')).props.value).toBe('Cuidado com o ombro');
  });

  it('apagar o texto e sair do campo remove a nota', async () => {
    await saveExerciseNote(db, supino, 'x');
    await montar();
    const campo = await screen.findByLabelText('Minha nota');
    await fireEvent.changeText(campo, '');
    await fireEvent(campo, 'blur');
    expect(await getExerciseNote(db, supino)).toBeNull();
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
    await treino(T0, [[80, 10]]);
    await montar();
    await screen.findByLabelText('Maior carga: 80 kg × 10');
    for (const el of screen.getAllByRole('button')) {
      const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
      expect(Math.max(s?.minHeight ?? 0, s?.height ?? 0)).toBeGreaterThanOrEqual(48);
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

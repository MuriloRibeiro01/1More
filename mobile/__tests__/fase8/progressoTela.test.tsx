import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ProgressScreen } from '../../src/screens/ProgressScreen';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { startOfWeek } from '../../src/workout/week';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Fase 8 — aba Progresso (PROGRESSO.DC.HTML): gráfico, métricas, recorde → Exercício, séries por músculo.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const Stack = createNativeStackNavigator<{ Home: undefined; Exercise: { exerciseId: string } }>();
const D = 86_400_000;
const SUPINO = 'Supino reto com barra';
const AGACHA = 'Agachamento livre';

let db: Database;
let supino: string;
let agachamento: string;
let rotinaId: string;

function montar() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={ProgressScreen} />
          <Stack.Screen name="Exercise" component={(({ route }: { route: { params: { exerciseId: string } } }) => <Text>{`EXERCICIO:${route.params.exerciseId}`}</Text>) as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

async function treino(inicio: number, feitas: { ex: number; w: number; r: number }[]) {
  const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin: 0 });
  const w = await loadWorkout(db, id);
  let t = 1;
  const usados = new Map<number, number>();
  for (const f of feitas) {
    const i = usados.get(f.ex) ?? 0;
    usados.set(f.ex, i + 1);
    await updateSet(db, w.exercises[f.ex].sets[i].id, { weightKg: f.w, reps: f.r, completed: true }, inicio + t++ * 60_000);
  }
  await finishWorkout(db, id, { pending: 'discard', now: inicio + 3_600_000 });
}

const semana = () => startOfWeek(new Date()).getTime() + 60_000;
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  supino = cat.find((e) => e.name === SUPINO)!.id;
  agachamento = cat.find((e) => e.name === AGACHA)!.id;
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [
      { exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
      { exerciseId: agachamento, sets: 2, weightKg: 100, repsMin: null, repsMax: 5, restSeconds: 90 },
    ],
  });
});

async function comHistorico() {
  await treino(semana() - 10 * D, [{ ex: 0, w: 60, r: 10 }]);
  await treino(semana(), [{ ex: 0, w: 62.5, r: 10 }, { ex: 1, w: 100, r: 5 }]);
}

describe('sem dados', () => {
  it('mostra o estado vazio e nenhum gráfico', async () => {
    await montar();
    expect(await screen.findByRole('header', { name: 'Progresso' })).toBeOnTheScreen();
    expect(await screen.findByText('Sem dados ainda')).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();
  });
});

describe('gráfico e métricas', () => {
  it('abre no exercício mais recente com 1RM e descreve o gráfico para o leitor de tela', async () => {
    await comHistorico();
    await montar();
    expect(await screen.findByRole('image', { name: `1RM estimado de ${AGACHA}: 1 treino, último 116,67 kg` })).toBeOnTheScreen();
    expect(await botao(AGACHA)).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
  });

  it('trocar o exercício muda o gráfico', async () => {
    await comHistorico();
    await montar();
    await fireEvent.press(await botao(SUPINO));
    expect(await screen.findByRole('image', { name: `1RM estimado de ${SUPINO}: 2 treinos, último 83,33 kg` })).toBeOnTheScreen();
  });

  it('trocar a métrica: melhor série e volume', async () => {
    await comHistorico();
    await montar();
    await fireEvent.press(await botao(SUPINO));
    await fireEvent.press(await botao('Melhor série'));
    expect(await screen.findByRole('image', { name: `Melhor série de ${SUPINO}: 2 treinos, último 62,5 kg` })).toBeOnTheScreen();
    await fireEvent.press(await botao('Volume'));
    expect(await screen.findByRole('image', { name: `Volume de ${SUPINO}: 2 treinos, último 625 kg` })).toBeOnTheScreen();
  });

  it('sem nenhuma série de 1 a 12 reps o 1RM não existe: avisa em vez de desenhar (RN-10)', async () => {
    await treino(semana(), [{ ex: 0, w: 20, r: 15 }]);
    await montar();
    expect(await screen.findByText('Sem dados suficientes para este gráfico.')).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();
  });
});

describe('recorde e semana', () => {
  it('a linha de recorde mostra o melhor valor da métrica e abre o Exercício', async () => {
    await comHistorico();
    await montar();
    await fireEvent.press(await botao(SUPINO));
    const linha = await screen.findByLabelText(/^Recorde: 1RM estimado 83,33 kg/);
    await fireEvent.press(linha);
    expect(await screen.findByText(`EXERCICIO:${supino}`)).toBeOnTheScreen();
  });

  it('séries por músculo na semana, em uma linha de texto (RF-45)', async () => {
    await comHistorico();
    await montar();
    expect(await screen.findByLabelText('Séries na semana: Peito 1 · Quadríceps 1')).toBeOnTheScreen();
  });

  it('semana sem treino diz que não há séries', async () => {
    await treino(semana() - 10 * D, [{ ex: 0, w: 60, r: 10 }]);
    await montar();
    expect(await screen.findByLabelText('Séries na semana: Nenhuma série esta semana')).toBeOnTheScreen();
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
    await comHistorico();
    await montar();
    await screen.findByRole('image');
    for (const el of screen.getAllByRole('button')) {
      const flat = Array.isArray(el.props.style) ? Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean)) : el.props.style ?? {};
      expect(Math.max(flat.minHeight ?? 0, flat.height ?? 0)).toBeGreaterThanOrEqual(48);
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

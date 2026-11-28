import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { discardWorkout, finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a, item 5 (C19): tela sempre ligada durante o treino (expo-keep-awake ~58.0.4, aprovada pelo Leônidas:
// só FLAG_KEEP_SCREEN_ON, sem permissão). Decisão do PO (2026-11-27): a tela fica ligada ENQUANTO HOUVER TREINO ATIVO,
// inclusive com o treino minimizado (descanso correndo, faixa Retomar). Libera ao finalizar, descartar, quando não há
// mais treino ativo e ao desmontar o provedor. Logo o keep-awake vive acima da tela do treino (provedor/hook no
// RootNavigator), por isso estes testes montam o RootNavigator de verdade.
// O módulo é mockado com um rastreador que serve para qualquer uso da API (hook `useKeepAwake`, `activateKeepAwakeAsync`/
// `activateKeepAwake` e `deactivateKeepAwake`, com ou sem tag): `ativos()` diz quantas tags estão ligadas agora.
jest.mock(
  'expo-keep-awake',
  () => {
    const React = require('react') as typeof import('react');
    const ligadas = new Set<string>();
    const DEFAULT = 'ExpoKeepAwakeDefaultTag';
    const ativa = (tag?: string) => void ligadas.add(tag ?? DEFAULT);
    const libera = (tag?: string) => void ligadas.delete(tag ?? DEFAULT);
    return {
      __ligadas: ligadas,
      activateKeepAwakeAsync: jest.fn(async (tag?: string) => ativa(tag)),
      activateKeepAwake: jest.fn((tag?: string) => ativa(tag)),
      deactivateKeepAwake: jest.fn(async (tag?: string) => libera(tag)),
      useKeepAwake: jest.fn((tag?: string) => {
        React.useEffect(() => {
          ativa(tag);
          return () => libera(tag);
        }, [tag]);
      }),
    };
  },
  { virtual: true },
);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const mockKeepAwake = jest.requireMock('expo-keep-awake') as { __ligadas: Set<string> };
const ativos = () => mockKeepAwake.__ligadas.size;

const SUPINO = 'Supino reto com barra';
let db: Database;
let rotinaId: string;

type Rota = { name: 'Tabs' | 'ActiveWorkout' | 'WorkoutDetail'; params?: object };
function montar(rotas: Rota[]) {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: rotas as never }}>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
const noTreino = (workoutId: string): Rota[] => [{ name: 'Tabs' }, { name: 'ActiveWorkout', params: { workoutId } }];

const caixa = (n: number) => screen.findByRole('checkbox', { name: `Série ${n} de ${SUPINO}` });
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const faixaRetomar = () => screen.findByRole('button', { name: 'Treino em andamento · Retomar' });

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockKeepAwake.__ligadas.clear();
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const ex = (await listCatalog(db)).find((e) => e.name === SUPINO)!;
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ex.id, sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('tela ligada enquanto há treino ativo (C19)', () => {
  it('treino ativo aberto: a tela fica ligada', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(noTreino(id));
    await caixa(1);
    expect(ativos()).toBeGreaterThan(0);
  });

  it('sem treino ativo (só as abas): nada fica ligado', async () => {
    await montar([{ name: 'Tabs' }]);
    await screen.findAllByRole('tab');
    expect(ativos()).toBe(0);
  });

  it('treino ativo fora da tela do treino (app reaberto, aba Treinar com a faixa Retomar): a tela fica ligada', async () => {
    await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar([{ name: 'Tabs' }]);
    await faixaRetomar();
    expect(ativos()).toBeGreaterThan(0);
  });

  it('treino passado (já finalizado) aberto no Histórico não liga a tela', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() - 86_400_000 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, Date.now() - 86_400_000 + 60_000);
    await finishWorkout(db, id, { pending: 'discard', now: Date.now() - 86_400_000 + 120_000 });
    await montar([{ name: 'Tabs' }, { name: 'WorkoutDetail', params: { workoutId: id } }]);
    await screen.findByRole('button', { name: 'Voltar' });
    expect(ativos()).toBe(0);
  });
});

describe('minimizar NÃO libera a tela (decisão do PO)', () => {
  it('minimizar o treino (seta para baixo): o treino segue ativo, a faixa Retomar aparece e a tela continua ligada', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(noTreino(id));
    await caixa(1);
    await fireEvent.press(await botao('Minimizar treino'));
    await faixaRetomar();
    expect(ativos()).toBeGreaterThan(0);
  });

  it('minimizado com o descanso correndo: a tela continua ligada', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(noTreino(id));
    await fireEvent.press(await caixa(1)); // inicia o descanso
    await fireEvent.press(await botao('Minimizar treino'));
    await faixaRetomar();
    expect(ativos()).toBeGreaterThan(0);
  });

  it('retomar o treino minimizado mantém a tela ligada', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(noTreino(id));
    await fireEvent.press(await botao('Minimizar treino'));
    await fireEvent.press(await faixaRetomar());
    await caixa(1);
    expect(ativos()).toBeGreaterThan(0);
  });
});

describe('liberar a tela', () => {
  it('ao finalizar o treino (vai para o resumo) a tela volta ao normal', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(noTreino(id));
    for (const n of [1, 2]) await fireEvent.press(await caixa(n));
    expect(ativos()).toBeGreaterThan(0);
    await fireEvent.press(await botao('Finalizar'));
    await screen.findByRole('header', { name: 'Treino finalizado' });
    expect(ativos()).toBe(0);
  });

  it('ao descartar o treino a tela volta ao normal (não há mais treino ativo)', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(noTreino(id));
    await caixa(1);
    expect(ativos()).toBeGreaterThan(0);
    await fireEvent.press(await botao('Finalizar')); // nenhuma série feita → oferece descartar
    await fireEvent.press(await botao('Descartar treino'));
    await screen.findAllByRole('tab');
    expect(ativos()).toBe(0);
  });

  it('quando o treino deixa de existir com o app nas abas (descartado por fora), a tela volta ao normal', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar([{ name: 'Tabs' }]);
    await faixaRetomar();
    expect(ativos()).toBeGreaterThan(0);
    await act(async () => {
      await discardWorkout(db, id);
    });
    await waitFor(() => expect(ativos()).toBe(0));
  });

  it('ao desmontar o provedor (app fecha) a tela volta ao normal', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    const app = await montar(noTreino(id));
    await caixa(1);
    expect(ativos()).toBeGreaterThan(0);
    await act(async () => app.unmount());
    expect(ativos()).toBe(0);
  });
});

describe('sem rede', () => {
  it('ligar a tela não faz chamada de rede', async () => {
    const rede = jest.fn();
    const original = globalThis.fetch;
    globalThis.fetch = rede as never;
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(noTreino(id));
    await caixa(1);
    expect(ativos()).toBeGreaterThan(0);
    expect(rede).not.toHaveBeenCalled();
    globalThis.fetch = original;
  });
});

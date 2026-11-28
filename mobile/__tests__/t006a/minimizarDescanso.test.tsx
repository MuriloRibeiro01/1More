import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Vibration } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a (a), decisão do PO: MINIMIZAR o treino no meio do descanso NÃO cancela a notificação nem o timer.
// O aviso continua agendado para o horário de término; ao voltar pela faixa Retomar o descanso mostra o tempo restante certo;
// finalizar, descartar e pular continuam cancelando. O timer e o notifier passam para o nível do RootNavigator (acima da tela
// do treino), por isso o teste monta o RootNavigator de verdade.
jest.mock(
  'expo-notifications',
  () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    cancelAllScheduledNotificationsAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationHandler: jest.fn(),
    AndroidImportance: { DEFAULT: 3, HIGH: 4 },
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  }),
  { virtual: true },
);
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn(), activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() }), { virtual: true });
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

type Mock = ReturnType<typeof jest.fn>;
const notif = jest.requireMock('expo-notifications') as Record<
  'getPermissionsAsync' | 'requestPermissionsAsync' | 'scheduleNotificationAsync' | 'cancelScheduledNotificationAsync',
  Mock
>;

const SUPINO = 'Supino reto com barra';
let db: Database;
let workoutId: string;
let seq = 0;

function montar() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Tabs' }, { name: 'ActiveWorkout', params: { workoutId } }] }}>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
const caixa = (n: number) => screen.findByRole('checkbox', { name: `Série ${n} de ${SUPINO}` });
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const faixaRetomar = () => botao('Treino em andamento · Retomar');
const tempo = () => screen.queryByText(/^\d+:\d{2}$/);
const passar = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

async function minimizarNoDescanso() {
  await montar();
  await fireEvent.press(await caixa(1)); // descanso de 1:30 começa
  await act(async () => {});
  await fireEvent.press(await botao('Minimizar treino'));
  await faixaRetomar();
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  seq = 0;
  notif.getPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  notif.requestPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted', granted: true });
  notif.scheduleNotificationAsync.mockReset().mockImplementation(async () => `notif-${++seq}`);
  notif.cancelScheduledNotificationAsync.mockReset().mockResolvedValue(undefined);
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

describe('minimizar no meio do descanso', () => {
  it('a notificação continua agendada: nada é cancelado e nada é agendado de novo', async () => {
    await minimizarNoDescanso();
    expect(notif.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notif.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('o aviso segue para o horário de término original, mesmo depois de passar tempo minimizado', async () => {
    await minimizarNoDescanso();
    const disparo = (notif.scheduleNotificationAsync.mock.calls[0][0] as { trigger: { date: Date } }).trigger.date.getTime();
    await passar(30_000);
    expect(notif.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(Math.abs(disparo - (Date.now() + 60_000))).toBeLessThanOrEqual(1500); // ainda faltam 60 s
  });

  it('ao voltar pela faixa Retomar, o descanso mostra o tempo restante certo (1:30 − 30 s = 1:00)', async () => {
    await minimizarNoDescanso();
    await passar(30_000);
    await fireEvent.press(await faixaRetomar());
    await caixa(1);
    expect(tempo()).toHaveTextContent('1:00');
  });

  it('minimizar e voltar duas vezes não duplica o aviso nem reinicia o descanso', async () => {
    await minimizarNoDescanso();
    await passar(10_000);
    await fireEvent.press(await faixaRetomar());
    await caixa(1);
    await fireEvent.press(await botao('Minimizar treino'));
    await faixaRetomar();
    await passar(10_000);
    await fireEvent.press(await faixaRetomar());
    await caixa(1);
    expect(tempo()).toHaveTextContent('1:10');
    expect(notif.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notif.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('o descanso zera enquanto o treino está minimizado: vibra uma vez e, ao voltar, mostra 0:00', async () => {
    const vibrar = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    await minimizarNoDescanso();
    await passar(95_000);
    expect(vibrar).toHaveBeenCalledTimes(1);
    await fireEvent.press(await faixaRetomar());
    await caixa(1);
    expect(tempo()).toHaveTextContent('0:00');
  });
});

describe('o que continua cancelando', () => {
  it('Pular, depois de minimizar e voltar, cancela a pendente', async () => {
    await minimizarNoDescanso();
    await fireEvent.press(await faixaRetomar());
    await caixa(1);
    await fireEvent.press(await botao('Pular'));
    await act(async () => {});
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    expect(tempo()).toBeNull();
  });

  it('+15 s depois de voltar reagenda (cancela a antiga, agenda outra 15 s depois)', async () => {
    await minimizarNoDescanso();
    await fireEvent.press(await faixaRetomar());
    await fireEvent.press(await botao('+15 s'));
    await act(async () => {});
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    expect(notif.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('finalizar o treino (depois de minimizar e voltar) cancela a pendente e o descanso some', async () => {
    await minimizarNoDescanso();
    await fireEvent.press(await faixaRetomar());
    for (const n of [2, 3]) await fireEvent.press(await caixa(n)); // conclui o resto: cada conclusão reagenda
    await act(async () => {});
    notif.cancelScheduledNotificationAsync.mockClear();
    await fireEvent.press(await botao('Finalizar'));
    await screen.findByRole('header', { name: 'Treino finalizado' });
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalled();
    await fireEvent.press(await botao('Fechar'));
    await screen.findAllByRole('tab');
    expect(tempo()).toBeNull();
  });

  it('descartar o treino (depois de minimizar e voltar) cancela a pendente e o descanso some', async () => {
    await minimizarNoDescanso();
    await fireEvent.press(await faixaRetomar());
    await caixa(1);
    await fireEvent.press(await caixa(1)); // desmarca: nenhuma série concluída
    await fireEvent.press(await botao('Finalizar'));
    await fireEvent.press(await botao('Descartar treino'));
    await act(async () => {});
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    await screen.findAllByRole('tab');
    expect(tempo()).toBeNull();
  });
});

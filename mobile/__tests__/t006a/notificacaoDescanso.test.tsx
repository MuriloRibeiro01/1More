import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, WorkoutSummaryRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { loadWorkout, startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a, item 4 (C18): notificação LOCAL do fim do descanso (expo-notifications ~58.1.9, aprovada pelo Leônidas).
// Regras: concluir série com descanso agenda UMA notificação para o horário de término; texto genérico "Descanso acabou"
// (sem exercício, carga nem nome do treino); pular, +15 s (reagenda) ou finalizar/descartar cancelam a pendente;
// permissão POST_NOTIFICATIONS negada (ou agendamento que falha) NUNCA bloqueia o treino: o timer na tela continua.
// O módulo é mockado (ainda não está instalado): `virtual: true`.
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
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

type Mock = ReturnType<typeof jest.fn>;
const mockNotif = jest.requireMock('expo-notifications') as Record<
  'getPermissionsAsync' | 'requestPermissionsAsync' | 'scheduleNotificationAsync' | 'cancelScheduledNotificationAsync' | 'cancelAllScheduledNotificationsAsync',
  Mock
>;

const SUPINO = 'Supino reto com barra';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
let db: Database;
let workoutId: string;
let seq = 0;

function montar() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ActiveWorkout', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
          <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const caixa = (n: number) => screen.findByRole('checkbox', { name: `Série ${n} de ${SUPINO}` });
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const tempo = () => screen.queryByText(/^\d+:\d{2}$/);
type Chamada = { content?: Record<string, unknown>; trigger?: unknown };
const chamadas = () => mockNotif.scheduleNotificationAsync.mock.calls.map((c) => c[0] as Chamada);
const chamada = (i: number): Chamada => {
  const c = chamadas()[i];
  if (!c) throw new Error(`funcionalidade ausente: scheduleNotificationAsync não foi chamado (chamada ${i + 1})`);
  return c;
};
/** Horário de disparo pedido, em ms, venha o gatilho como data ou como segundos a partir de agora. */
function disparoDe(c: Chamada): number {
  const t = c.trigger as unknown;
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  const o = t as { date?: Date | number; seconds?: number };
  if (o?.date !== undefined) return new Date(o.date).getTime();
  if (typeof o?.seconds === 'number') return Date.now() + o.seconds * 1000;
  throw new Error(`gatilho sem data nem segundos: ${JSON.stringify(t)}`);
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  seq = 0;
  mockNotif.getPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  mockNotif.requestPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  mockNotif.scheduleNotificationAsync.mockReset().mockImplementation(async () => `notif-${++seq}`);
  mockNotif.cancelScheduledNotificationAsync.mockReset().mockResolvedValue(undefined);
  mockNotif.cancelAllScheduledNotificationsAsync.mockReset().mockResolvedValue(undefined);
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const ex = (await listCatalog(db)).find((e) => e.name === SUPINO)!;
  const rotina = await saveRoutine(db, {
    name: 'Peito pesado',
    exercises: [{ exerciseId: ex.id, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('agendar ao concluir a série', () => {
  it('concluir a série com descanso de 1:30 agenda UMA notificação para o horário de término do descanso', async () => {
    await montar();
    const antes = Date.now();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    expect(mockNotif.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Math.abs(disparoDe(chamada(0)) - (antes + 90_000))).toBeLessThanOrEqual(1500);
  });

  it('o texto é genérico: "Descanso acabou", sem exercício, carga, repetições nem nome do treino', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    const conteudo = JSON.stringify(chamada(0).content);
    expect(chamada(0).content).toMatchObject({ title: 'Descanso acabou' });
    expect(conteudo).not.toMatch(/Supino|Peito|pesado|60|kg|série/i);
  });

  it('concluir a próxima série com o descanso ainda correndo cancela a anterior e agenda a nova (uma de cada vez)', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    await fireEvent.press(await caixa(2));
    await act(async () => {});
    expect(mockNotif.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockNotif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    expect(mockNotif.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('notif-2');
  });

  it('desmarcar uma série não agenda nada', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    mockNotif.scheduleNotificationAsync.mockClear();
    await fireEvent.press(await caixa(1)); // desmarca
    await act(async () => {});
    expect(mockNotif.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelar e reagendar', () => {
  it('Pular o descanso cancela a notificação pendente', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    await fireEvent.press(await botao('Pular'));
    await act(async () => {});
    expect(mockNotif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    expect(tempo()).toBeNull();
  });

  it('+15 s reagenda: cancela a antiga e agenda outra 15 s depois', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    const primeiro = disparoDe(chamada(0));
    await fireEvent.press(await botao('+15 s'));
    await act(async () => {});
    expect(mockNotif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    expect(mockNotif.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Math.abs(disparoDe(chamada(1)) - (primeiro + 15_000))).toBeLessThanOrEqual(1500);
  });

  it('finalizar o treino cancela a notificação pendente', async () => {
    await montar();
    for (const n of [1, 2, 3]) await fireEvent.press(await caixa(n)); // a última conclusão deixa um descanso agendado
    await act(async () => {});
    mockNotif.cancelScheduledNotificationAsync.mockClear();
    await fireEvent.press(await botao('Finalizar'));
    await screen.findByRole('header', { name: 'Treino finalizado' });
    expect(mockNotif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-3');
  });

  it('descartar o treino cancela a notificação pendente', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    await fireEvent.press(await caixa(1)); // desmarca: nenhuma série concluída → Finalizar oferece descartar
    await fireEvent.press(await botao('Finalizar'));
    await fireEvent.press(await botao('Descartar treino'));
    await act(async () => {});
    expect(mockNotif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
  });
});

describe('permissão POST_NOTIFICATIONS e falhas: nunca bloqueiam o treino', () => {
  it('permissão negada: a série é gravada, o timer na tela continua e nada é agendado', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });
    mockNotif.requestPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    expect(mockNotif.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(tempo()).toHaveTextContent('1:30');
    expect((await loadWorkout(db, workoutId)).exercises[0].sets[0].completedAt).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('permissão ainda não decidida: pede em tempo de execução, uma única vez, e agenda se concedida', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', granted: false, canAskAgain: true });
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    await fireEvent.press(await caixa(2));
    await act(async () => {});
    expect(mockNotif.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockNotif.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('pedido de permissão negado: não insiste nas séries seguintes e o treino segue', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', granted: false, canAskAgain: true });
    mockNotif.requestPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    await fireEvent.press(await caixa(2));
    await act(async () => {});
    expect(mockNotif.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockNotif.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(tempo()).toBeOnTheScreen();
  });

  it('permissão já concedida: não pede de novo', async () => {
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    expect(mockNotif.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('o agendamento falhar (módulo lança) não derruba a série nem o timer, e não mostra erro de gravação', async () => {
    mockNotif.scheduleNotificationAsync.mockRejectedValue(new Error('sem canal'));
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    expect((await loadWorkout(db, workoutId)).exercises[0].sets[0].completedAt).not.toBeNull();
    expect(tempo()).toHaveTextContent('1:30');
    expect(screen.queryByText(/não foi possível gravar|falha ao gravar/i)).toBeNull();
    erro.mockRestore();
  });

  it('cancelar falhar também não bloqueia (Pular continua zerando o timer)', async () => {
    mockNotif.cancelScheduledNotificationAsync.mockRejectedValue(new Error('x'));
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    await fireEvent.press(await caixa(1));
    await act(async () => {});
    await fireEvent.press(await botao('Pular'));
    await act(async () => {});
    expect(tempo()).toBeNull();
    erro.mockRestore();
  });
});

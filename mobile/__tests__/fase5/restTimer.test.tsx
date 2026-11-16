import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Vibration } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { remainingSeconds, useRestTimer } from '../../src/workout/restTimer';

// Timer de descanso guarda o HORÁRIO DE TÉRMINO (não conta ticks): sobrevive a tela travada/segundo plano.

describe('remainingSeconds', () => {
  it('arredonda para cima e não fica negativo', () => {
    expect(remainingSeconds(10_000, 0)).toBe(10);
    expect(remainingSeconds(10_000, 500)).toBe(10);
    expect(remainingSeconds(10_000, 9_001)).toBe(1);
    expect(remainingSeconds(10_000, 10_000)).toBe(0);
    expect(remainingSeconds(10_000, 20_000)).toBe(0);
  });
});

describe('useRestTimer', () => {
  let vibrate: jest.SpiedFunction<typeof Vibration.vibrate>;
  beforeEach(() => {
    jest.useFakeTimers({ now: 1_000_000 });
    vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    vibrate.mockRestore();
  });

  const passar = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

  it('começa parado', async () => {
    const { result } = await renderHook(() => useRestTimer());
    expect(result.current).toMatchObject({ remaining: null, finished: false });
  });

  it('start conta regressivo pelo relógio e +15s soma ao término', async () => {
    const { result } = await renderHook(() => useRestTimer());
    await act(() => result.current.start(90));
    expect(result.current.remaining).toBe(90);
    await passar(30_000);
    expect(result.current.remaining).toBe(60);
    await act(() => result.current.add(15));
    expect(result.current.remaining).toBe(75);
  });

  it('segue o relógio mesmo se os ticks pararem (app em segundo plano)', async () => {
    const { result } = await renderHook(() => useRestTimer());
    await act(() => result.current.start(60));
    jest.setSystemTime(1_000_000 + 45_000); // salto sem ticks
    await passar(250);
    expect(result.current.remaining).toBe(15);
  });

  it('pular zera e esconde; novo start recomeça do zero', async () => {
    const { result } = await renderHook(() => useRestTimer());
    await act(() => result.current.start(90));
    await passar(10_000);
    await act(() => result.current.skip());
    expect(result.current.remaining).toBeNull();
    await act(() => result.current.start(45));
    expect(result.current.remaining).toBe(45);
  });

  it('ao zerar fica finished, mostra 0 e vibra uma única vez', async () => {
    const { result } = await renderHook(() => useRestTimer());
    await act(() => result.current.start(5));
    await passar(4_000);
    expect(result.current.finished).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    await passar(2_000);
    expect(result.current).toMatchObject({ remaining: 0, finished: true });
    await passar(5_000);
    expect(vibrate).toHaveBeenCalledTimes(1);
    await act(() => result.current.skip());
    expect(result.current).toMatchObject({ remaining: null, finished: false });
  });

  it('+15s depois de zerar reativa o descanso', async () => {
    const { result } = await renderHook(() => useRestTimer());
    await act(() => result.current.start(2));
    await passar(3_000);
    expect(result.current.finished).toBe(true);
    await act(() => result.current.add(15));
    expect(result.current).toMatchObject({ remaining: 15, finished: false });
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { createRestNotifier } from './restNotification';

/** Segundos que faltam para `endAt` (ms), arredondados para cima, nunca negativos. */
export const remainingSeconds = (endAt: number, now: number) => Math.max(0, Math.ceil((endAt - now) / 1000));

const TICK_MS = 250;

/**
 * Descanso entre séries. Guarda o horário de término e recalcula pelo relógio a cada tick,
 * então não "perde tempo" se o app ficar em segundo plano. Ao zerar fica `finished` e vibra uma vez.
 * O aviso com o app em segundo plano é uma notificação local agendada para `endAt` (restNotification.ts):
 * reagendada a cada mudança do horário (+15 s) e cancelada ao pular, finalizar ou sair da tela.
 */
export function useRestTimer() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Sobe a cada start/+15 s: reagenda o aviso mesmo que o horário calculado coincida. */
  const [run, setRun] = useState(0);
  const vibrated = useRef(false);
  const notifier = useRef(createRestNotifier());

  useEffect(() => {
    if (endAt === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [endAt]);

  useEffect(() => {
    if (endAt === null) return undefined;
    const current = notifier.current;
    current.schedule(endAt);
    return () => {
      void current.cancel();
    };
  }, [endAt, run]);

  const remaining = endAt === null ? null : remainingSeconds(endAt, now);
  const finished = remaining === 0;

  useEffect(() => {
    if (finished && !vibrated.current) {
      vibrated.current = true;
      Vibration.vibrate(400);
    }
  }, [finished]);

  const start = useCallback((seconds: number) => {
    vibrated.current = false;
    setNow(Date.now());
    setEndAt(Date.now() + seconds * 1000);
    setRun((r) => r + 1);
  }, []);
  const add = useCallback(
    (seconds: number) =>
      setEndAt((current) => {
        if (current === null) return current;
        // Depois de zerar, +15s recomeça a partir de agora.
        const base = Math.max(current, Date.now());
        if (base > current) vibrated.current = false;
        return base + seconds * 1000;
      }),
    [],
  );
  const skip = useCallback(() => setEndAt(null), []);

  return { remaining, finished, start, add, skip };
}

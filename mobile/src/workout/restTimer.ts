import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

/** Segundos que faltam para `endAt` (ms), arredondados para cima, nunca negativos. */
export const remainingSeconds = (endAt: number, now: number) => Math.max(0, Math.ceil((endAt - now) / 1000));

const TICK_MS = 250;

/**
 * Descanso entre séries. Guarda o horário de término e recalcula pelo relógio a cada tick,
 * então não "perde tempo" se o app ficar em segundo plano. Ao zerar fica `finished` e vibra uma vez.
 * (Notificação local com o app fechado entra com `expo-notifications`, dependência a revisar.)
 */
export function useRestTimer() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const vibrated = useRef(false);

  useEffect(() => {
    if (endAt === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [endAt]);

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

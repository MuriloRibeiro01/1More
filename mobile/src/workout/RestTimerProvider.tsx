import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useRestTimer } from './restTimer';
import { useActiveWorkout } from './useActiveWorkout';

type RestTimer = ReturnType<typeof useRestTimer>;
const RestTimerContext = createContext<RestTimer | null>(null);

/**
 * T-006a (a): o descanso e o aviso local vivem ACIMA da tela do treino. Minimizar o treino (a tela desmonta) não cancela
 * o timer nem a notificação; ao voltar pela faixa Retomar o tempo restante sai do relógio. Quando o treino ativo deixa de
 * existir (finalizar ou descartar), o descanso é encerrado e o aviso, cancelado.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const timer = useRestTimer();
  const active = useActiveWorkout(useDatabase());
  const { remaining, finished, start, add, skip } = timer;

  useEffect(() => {
    if (active === null && remaining !== null) skip();
  }, [active, remaining, skip]);

  const value = useMemo(() => ({ remaining, finished, start, add, skip }), [remaining, finished, start, add, skip]);
  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

/** Descanso compartilhado. Fora do provedor (tela montada isolada) cai num timer local, que some com a tela. */
export function useSharedRestTimer(): RestTimer {
  const shared = useContext(RestTimerContext);
  const local = useRestTimer();
  return shared ?? local;
}

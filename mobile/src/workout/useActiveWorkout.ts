import { useEffect, useState } from 'react';
import type { Database } from '@nozbe/watermelondb';
import { getActiveWorkout, type ActiveWorkout } from './repository';
import { isForgotten } from './rules';

export type ActiveWorkoutState = ActiveWorkout & { forgotten: boolean };

/**
 * Treino ativo do aparelho, atualizado sempre que `workout`/`workout_set` mudam. null = nenhum (ou ainda lendo).
 * `forgotten` (RN-04) é calculado a cada leitura. shortcut: não vira sozinho com o app aberto sem mexer no banco; reler a cada minuto se isso importar.
 */
export function useActiveWorkout(db: Database): ActiveWorkoutState | null {
  const [active, setActive] = useState<ActiveWorkoutState | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getActiveWorkout(db)
        .then((w) => alive && setActive(w && { ...w, forgotten: isForgotten(w.lastActivityAt, Date.now()) }))
        .catch((error) => console.error('[treino] falha ao ler o treino ativo', error));
    const sub = db.withChangesForTables(['workout', 'workout_set']).subscribe(() => void load());
    void load();
    return () => {
      alive = false;
      sub.unsubscribe();
    };
  }, [db]);

  return active;
}

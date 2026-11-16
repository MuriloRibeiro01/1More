import { roundKg } from '../routines/rules';
import type { ExerciseSession } from '../workout/sessions';

export type LoadSuggestion = { kind: 'raise' | 'keep' | 'reduce'; weightKg: number };

/**
 * Progressão dupla (RN-12). Só sugestão, nunca preenche nada.
 * Sobe se todas as séries da última sessão bateram `repsMax`; reduz 10% se todas as séries de cada uma
 * das 2 últimas sessões ficaram abaixo de `repsMin`; senão mantém. Sem sessão ou sem topo da faixa: null.
 */
export function suggestLoad(input: {
  sessions: ExerciseSession[];
  repsMin: number | null;
  repsMax: number | null;
  incrementKg?: number;
}): LoadSuggestion | null {
  const { sessions, repsMin, repsMax, incrementKg = 2.5 } = input;
  const last = sessions[sessions.length - 1];
  if (!last || repsMax === null) return null;

  const work = Math.max(...last.sets.map((s) => s.weightKg ?? 0));
  if (last.sets.every((s) => (s.reps as number) >= repsMax)) return { kind: 'raise', weightKg: roundKg(work + incrementKg) };

  const lastTwo = sessions.slice(-2);
  const belowMin = (s: ExerciseSession) => s.sets.every((x) => (x.reps as number) < (repsMin as number));
  if (repsMin !== null && lastTwo.length === 2 && lastTwo.every(belowMin)) return { kind: 'reduce', weightKg: roundKg(work * 0.9) };

  return { kind: 'keep', weightKg: work };
}

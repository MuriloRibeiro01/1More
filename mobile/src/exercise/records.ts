import { roundKg } from '../routines/rules';
import { epley1RM } from '../workout/rules';
import type { ExerciseSession } from '../workout/sessions';

export interface ExerciseRecord {
  weightKg: number;
  reps: number;
  /** O número do recorde: carga, 1RM, volume ou repetições, conforme o tipo. */
  value: number;
  startedAt: number;
  workoutId: string;
}
export interface ExerciseRecords {
  weight?: ExerciseRecord;
  oneRm?: ExerciseRecord;
  setVolume?: ExerciseRecord;
  reps?: ExerciseRecord;
}

type Candidate = ExerciseRecord & { tie: number };

/** Recordes (RN-11) das séries válidas. Empate total: vale a ocorrência mais antiga (quem bateu primeiro). */
export function exerciseRecords(sessions: ExerciseSession[]): ExerciseRecords {
  const all = sessions.flatMap((s) =>
    s.sets.map((set) => ({ weightKg: set.weightKg ?? 0, reps: set.reps as number, startedAt: s.startedAt, workoutId: s.workoutId })),
  );
  // `tie`: critério de desempate antes da data (maior é melhor).
  const best = (score: (s: (typeof all)[number]) => { value: number; tie: number } | null): ExerciseRecord | undefined => {
    let top: Candidate | undefined;
    for (const s of all) {
      const sc = score(s);
      if (!sc) continue;
      const beats =
        !top ||
        sc.value > top.value ||
        (sc.value === top.value && sc.tie > top.tie) ||
        (sc.value === top.value && sc.tie === top.tie && s.startedAt < top.startedAt);
      if (beats) top = { ...s, ...sc };
    }
    if (!top) return undefined;
    const { tie: _tie, ...record } = top;
    return record;
  };

  return {
    weight: best((s) => ({ value: s.weightKg, tie: s.reps })),
    oneRm: best((s) => {
      const v = epley1RM(s.weightKg, s.reps);
      return v === null ? null : { value: v, tie: 0 };
    }),
    setVolume: best((s) => ({ value: roundKg(s.weightKg * s.reps), tie: 0 })),
    reps: best((s) => ({ value: s.reps, tie: s.weightKg })),
  };
}

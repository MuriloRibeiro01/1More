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
    // Carga 0/nula (peso corporal) não vale recorde de carga, 1RM nem volume: só repetições.
    weight: best((s) => (s.weightKg > 0 ? { value: s.weightKg, tie: s.reps } : null)),
    oneRm: best((s) => {
      const v = s.weightKg > 0 ? epley1RM(s.weightKg, s.reps) : null;
      return v === null ? null : { value: v, tie: 0 };
    }),
    setVolume: best((s) => (s.weightKg > 0 ? { value: roundKg(s.weightKg * s.reps), tie: 0 } : null)),
    reps: best((s) => ({ value: s.reps, tie: s.weightKg })),
  };
}
